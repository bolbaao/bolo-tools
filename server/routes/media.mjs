import { Router } from "express";
import axios from "axios";
import { env } from "../lib/env.mjs";
import { HttpError, sendError } from "../lib/http-error.mjs";

const router = Router();

const TYPE_MAP = {
  电影: "movie",
  剧集: "tv",
  综艺: "tv",
  动漫: "tv",
};

router.get("/search", async (req, res) => {
  try {
    const apiKey = env("TMDB_API_KEY");
    if (!apiKey) {
      throw new HttpError(
        503,
        "未配置 TMDB_API_KEY。请在 .env 中填入（免费申请：https://www.themoviedb.org/settings/api）",
      );
    }

    const query = String(req.query.q || "").trim();
    if (!query) throw new HttpError(400, "请输入搜索关键词");

    const category = String(req.query.category || "全部");
    const type = TYPE_MAP[category];
    const endpoint = type
      ? `https://api.themoviedb.org/3/search/${type}`
      : "https://api.themoviedb.org/3/search/multi";

    const { data } = await axios.get(endpoint, {
      params: {
        api_key: apiKey,
        query,
        language: "zh-CN",
        include_adult: false,
      },
      timeout: 15000,
    });

    const results = (data.results || []).slice(0, 12).map((item) => {
      const isMovie = item.media_type === "movie" || item.title;
      const title = item.title || item.name;
      const year = (item.release_date || item.first_air_date || "").slice(0, 4);
      const mediaType = isMovie ? "电影" : item.media_type === "tv" ? "剧集" : category === "全部" ? "其他" : category;
      return {
        id: item.id,
        title,
        year: year || "—",
        type: mediaType,
        quality: "TMDB",
        score: item.vote_average ? String(item.vote_average.toFixed(1)) : "—",
        overview: item.overview || "",
        poster: item.poster_path
          ? `https://image.tmdb.org/t/p/w200${item.poster_path}`
          : null,
      };
    });

    res.json({ ok: true, results });
  } catch (err) {
    if (err.response?.status === 401) {
      sendError(res, new HttpError(401, "TMDB API Key 无效"));
      return;
    }
    sendError(res, err);
  }
});

export default router;
