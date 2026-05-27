import { Router } from "express";
import axios from "axios";
import { env } from "../lib/env.mjs";
import { HttpError, sendError } from "../lib/http-error.mjs";
import {
  HOT_FALLBACK,
  enrichResult,
  mergeSearchResults,
  searchDouban,
  searchTmdbParallel,
} from "../lib/media-aggregate.mjs";
import {
  assertSearchAllowed,
  buildCopyText,
  searchMediaResources,
} from "../lib/media-resource-fetch.mjs";

const router = Router();
const TMDB = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";

function requireApiKey() {
  const apiKey = env("TMDB_API_KEY");
  if (!apiKey) {
    throw new HttpError(
      503,
      "未配置 TMDB_API_KEY。请在 .env 中填入（免费申请：https://www.themoviedb.org/settings/api）",
    );
  }
  return apiKey;
}

async function tmdbGet(path, apiKey, params = {}) {
  const { data } = await axios.get(`${TMDB}${path}`, {
    params: { api_key: apiKey, language: "zh-CN", ...params },
    timeout: 15000,
  });
  return data;
}

/** 多源并行检索 + 聚合去重 + 资源链接（核心逻辑） */
router.get("/aggregate-search", async (req, res) => {
  try {
    const apiKey = requireApiKey();
    const query = String(req.query.q || "").trim();
    if (!query) throw new HttpError(400, "请输入搜索关键词");

    const [doubanList, tmdbList] = await Promise.all([
      searchDouban(query),
      searchTmdbParallel(apiKey, query),
    ]);

    const merged = mergeSearchResults(doubanList, tmdbList);
    const results = await Promise.all(
      merged.slice(0, 16).map((item) => enrichResult(apiKey, item)),
    );

    res.json({
      ok: true,
      query,
      results,
      stats: {
        doubanHits: doubanList.length,
        tmdbHits: tmdbList.length,
        merged: results.length,
      },
    });
  } catch (err) {
    if (err.response?.status === 401) {
      sendError(res, new HttpError(401, "TMDB API Key 无效"));
      return;
    }
    sendError(res, err);
  }
});

router.get("/hot", async (req, res) => {
  try {
    const apiKey = requireApiKey();
    const [movies, tv] = await Promise.all([
      tmdbGet("/trending/movie/day", apiKey),
      tmdbGet("/trending/tv/day", apiKey),
    ]);
    const fromApi = [
      ...(movies.results || []).slice(0, 6).map((r) => r.title),
      ...(tv.results || []).slice(0, 6).map((r) => r.name),
    ].filter(Boolean);
    const keywords = [...new Set([...fromApi, ...HOT_FALLBACK])].slice(0, 16);
    res.json({ ok: true, keywords });
  } catch {
    res.json({ ok: true, keywords: HOT_FALLBACK });
  }
});

/** 多源并行检索网盘资源（参考公开检索聚合接口） */
router.get("/resource-search", async (req, res) => {
  try {
    const check = assertSearchAllowed(req.query.q);
    if (!check.ok) throw new HttpError(400, check.error);

    const result = await searchMediaResources(check.query);
    res.json({
      ok: true,
      query: result.query,
      sections: result.sections,
      stats: result.stats,
      copyText: buildCopyText(result),
      errors: result.errors,
    });
  } catch (err) {
    sendError(res, err);
  }
});

router.get("/detail", async (req, res) => {
  try {
    const apiKey = requireApiKey();
    const mediaType = String(req.query.type || "movie");
    const id = Number(req.query.id);
    if (!id) throw new HttpError(400, "无效 ID");

    const data = await tmdbGet(`/${mediaType}/${id}`, apiKey, {
      append_to_response: "credits,external_ids",
    });

    const isMovie = mediaType === "movie";
    const title = data.title || data.name;
    const year = (data.release_date || data.first_air_date || "").slice(0, 4) || "—";
    const cast = (data.credits?.cast || []).slice(0, 8).map((c) => c.name);
    const genres = (data.genres || []).map((g) => g.name).join(" · ");

    const item = {
      title,
      year,
      type: isMovie ? "电影" : "剧集",
      tmdbId: id,
      mediaType,
      score: data.vote_average ? String(data.vote_average.toFixed(1)) : null,
      overview: data.overview || "",
      poster: data.poster_path ? `${IMG}/w342${data.poster_path}` : null,
      genres,
      cast,
    };

    const enriched = await enrichResult(apiKey, {
      ...item,
      matchedFrom: ["TMDB"],
      popularity: 0,
      key: String(id),
    });

    res.json({ ok: true, item: enriched });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
