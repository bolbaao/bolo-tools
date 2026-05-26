import { Router } from "express";
import axios from "axios";
import { env } from "../lib/env.mjs";
import { HttpError, sendError } from "../lib/http-error.mjs";

const router = Router();
const TMDB = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";

const TYPE_MAP = {
  电影: "movie",
  剧集: "tv",
  综艺: "tv",
  动漫: "tv",
};

const ANIME_GENRE_ID = 16;

function mapItem(item, fallbackType = "其他") {
  const isMovie = item.media_type === "movie" || (item.title && !item.name);
  const title = item.title || item.name || "未知";
  const year = (item.release_date || item.first_air_date || "").slice(0, 4) || "—";
  let type = fallbackType;
  if (item.media_type === "movie" || isMovie) type = "电影";
  else if (item.media_type === "tv") type = "剧集";

  const genreIds = item.genre_ids || [];
  if (genreIds.includes(ANIME_GENRE_ID)) type = "动漫";

  return {
    id: item.id,
    mediaType: item.media_type || (isMovie ? "movie" : "tv"),
    title,
    year,
    type,
    score: item.vote_average ? String(item.vote_average.toFixed(1)) : "—",
    overview: item.overview || "",
    poster: item.poster_path ? `${IMG}/w342${item.poster_path}` : null,
    backdrop: item.backdrop_path ? `${IMG}/w780${item.backdrop_path}` : null,
    tmdbUrl: `https://www.themoviedb.org/${item.media_type || (isMovie ? "movie" : "tv")}/${item.id}`,
    popularity: item.popularity ?? 0,
  };
}

function filterByCategory(items, category) {
  if (category === "动漫") {
    return items.filter((i) => i.type === "动漫" || (i.mediaType === "tv" && i.type !== "电影"));
  }
  if (category === "综艺") {
    return items.filter((i) => i.mediaType === "tv" && i.type !== "动漫");
  }
  if (category === "电影") return items.filter((i) => i.mediaType === "movie" || i.type === "电影");
  if (category === "剧集") {
    return items.filter((i) => i.mediaType === "tv" && i.type === "剧集");
  }
  return items;
}

async function tmdbGet(path, apiKey, params = {}) {
  const { data } = await axios.get(`${TMDB}${path}`, {
    params: { api_key: apiKey, language: "zh-CN", ...params },
    timeout: 15000,
  });
  return data;
}

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

router.get("/trending", async (req, res) => {
  try {
    const apiKey = requireApiKey();
    const window = req.query.window === "week" ? "week" : "day";

    const [movies, tv] = await Promise.all([
      tmdbGet(`/trending/movie/${window}`, apiKey),
      tmdbGet(`/trending/tv/${window}`, apiKey),
    ]);

    const merged = [
      ...(movies.results || []).map((r) => ({ ...r, media_type: "movie" })),
      ...(tv.results || []).map((r) => ({ ...r, media_type: "tv" })),
    ]
      .map((item) => mapItem(item))
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 12);

    res.json({ ok: true, results: merged });
  } catch (err) {
    if (err.response?.status === 401) {
      sendError(res, new HttpError(401, "TMDB API Key 无效"));
      return;
    }
    sendError(res, err);
  }
});

router.get("/search", async (req, res) => {
  try {
    const apiKey = requireApiKey();
    const query = String(req.query.q || "").trim();
    if (!query) throw new HttpError(400, "请输入搜索关键词");

    const category = String(req.query.category || "全部");
    const type = TYPE_MAP[category];
    const endpoint = type ? `/search/${type}` : "/search/multi";

    const params = {
      query,
      include_adult: false,
      page: Math.min(Math.max(Number(req.query.page) || 1, 1), 5),
    };
    if (category === "动漫" && type === "tv") {
      params.with_genre = ANIME_GENRE_ID;
    }
    const data = await tmdbGet(endpoint, apiKey, params);

    let results = (data.results || [])
      .filter((item) => item.media_type !== "person")
      .map((item) => mapItem(item, category === "全部" ? "其他" : category));

    if (category !== "全部") {
      results = filterByCategory(results, category);
    }

    results = results.slice(0, 20);

    res.json({
      ok: true,
      results,
      total: data.total_results ?? results.length,
      page: data.page ?? 1,
    });
  } catch (err) {
    if (err.response?.status === 401) {
      sendError(res, new HttpError(401, "TMDB API Key 无效"));
      return;
    }
    sendError(res, err);
  }
});

router.get("/detail", async (req, res) => {
  try {
    const apiKey = requireApiKey();
    const mediaType = String(req.query.type || "movie");
    const id = Number(req.query.id);
    if (!id) throw new HttpError(400, "无效 ID");
    if (!["movie", "tv"].includes(mediaType)) throw new HttpError(400, "无效类型");

    const data = await tmdbGet(`/${mediaType}/${id}`, apiKey, {
      append_to_response: "credits,external_ids",
    });

    const cast = (data.credits?.cast || []).slice(0, 8).map((c) => c.name);
    const genres = (data.genres || []).map((g) => g.name).join(" · ");

    res.json({
      ok: true,
      item: {
        ...mapItem({ ...data, media_type: mediaType }),
        runtime: data.runtime || data.episode_run_time?.[0] || null,
        genres,
        cast,
        status: data.status || "",
        tagline: data.tagline || "",
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
