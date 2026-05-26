import axios from "axios";

const TMDB = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";
const ANIME_GENRE_ID = 16;

export const HOT_FALLBACK = [
  "星际穿越",
  "庆余年",
  "鬼灭之刃",
  "奥本海默",
  "繁花",
  "流浪地球",
  "千与千寻",
  "盗梦空间",
];

function normTitle(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[：:·\-\s]/g, "");
}

function mapTmdb(item) {
  const isMovie = item.media_type === "movie" || (item.title && !item.name);
  const title = item.title || item.name || "";
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);
  let type = isMovie ? "电影" : "剧集";
  if ((item.genre_ids || []).includes(ANIME_GENRE_ID)) type = "动漫";

  return {
    title,
    year,
    type,
    mediaType: item.media_type || (isMovie ? "movie" : "tv"),
    tmdbId: item.id,
    score: item.vote_average ? String(item.vote_average.toFixed(1)) : null,
    overview: item.overview || "",
    poster: item.poster_path ? `${IMG}/w342${item.poster_path}` : null,
    popularity: item.popularity ?? 0,
    source: "TMDB",
  };
}

export async function searchDouban(query) {
  try {
    const { data } = await axios.get("https://movie.douban.com/j/subject_suggest", {
      params: { q: query },
      timeout: 8000,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PineappleToolbox/1.0)",
        Referer: "https://movie.douban.com/",
      },
    });
    return (data || []).map((item) => ({
      title: item.title,
      year: String(item.year || ""),
      type: item.type === "tv" ? "剧集" : "电影",
      doubanId: String(item.id),
      poster: item.img || null,
      url: item.url || `https://movie.douban.com/subject/${item.id}/`,
      score: item.sub_title?.match(/[\d.]+/)?.[0] || null,
      overview: "",
      source: "豆瓣",
    }));
  } catch {
    return [];
  }
}

export async function searchTmdbParallel(apiKey, query) {
  const opts = { query, include_adult: false, page: 1, language: "zh-CN", api_key: apiKey };
  const [multi, movie, tv] = await Promise.allSettled([
    axios.get(`${TMDB}/search/multi`, { params: opts, timeout: 12000 }),
    axios.get(`${TMDB}/search/movie`, { params: opts, timeout: 12000 }),
    axios.get(`${TMDB}/search/tv`, { params: opts, timeout: 12000 }),
  ]);

  const items = [];
  const push = (res) => {
    if (res.status !== "fulfilled") return;
    for (const raw of res.value.data?.results || []) {
      if (raw.media_type && !["movie", "tv"].includes(raw.media_type)) continue;
      if (!raw.media_type && !raw.title && !raw.name) continue;
      items.push(mapTmdb(raw));
    }
  };
  push(multi);
  push(movie);
  push(tv);
  return items;
}

export function mergeSearchResults(doubanList, tmdbList) {
  const map = new Map();

  const upsert = (item, origin) => {
    const key = `${normTitle(item.title)}|${item.year || ""}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        title: item.title,
        year: item.year || "—",
        type: item.type || "影视",
        poster: item.poster || null,
        score: item.score || null,
        overview: item.overview || "",
        tmdbId: item.tmdbId || null,
        mediaType: item.mediaType || null,
        doubanId: item.doubanId || null,
        doubanUrl: item.url || null,
        matchedFrom: [origin],
        popularity: item.popularity ?? 0,
      });
      return;
    }
    if (!existing.matchedFrom.includes(origin)) existing.matchedFrom.push(origin);
    if (!existing.poster && item.poster) existing.poster = item.poster;
    if (!existing.score && item.score) existing.score = item.score;
    if (!existing.tmdbId && item.tmdbId) {
      existing.tmdbId = item.tmdbId;
      existing.mediaType = item.mediaType;
    }
    if (!existing.doubanId && item.doubanId) {
      existing.doubanId = item.doubanId;
      existing.doubanUrl = item.url;
    }
    if (!existing.overview && item.overview) existing.overview = item.overview;
    existing.popularity = Math.max(existing.popularity, item.popularity ?? 0);
  };

  for (const d of doubanList) upsert(d, "豆瓣");
  for (const t of tmdbList) upsert(t, "TMDB");

  return [...map.values()]
    .sort((a, b) => {
      const sa = a.matchedFrom.length;
      const sb = b.matchedFrom.length;
      if (sb !== sa) return sb - sa;
      return b.popularity - a.popularity;
    })
    .slice(0, 24);
}

export async function fetchWatchProviders(apiKey, mediaType, tmdbId) {
  try {
    const { data } = await axios.get(`${TMDB}/${mediaType}/${tmdbId}/watch/providers`, {
      params: { api_key: apiKey },
      timeout: 10000,
    });
    const region = data.results?.CN || data.results?.HK || data.results?.US || null;
    if (!region) return [];

    const links = [];
    const add = (list, kind) => {
      for (const p of list || []) {
        links.push({
          id: `watch-${p.provider_id}`,
          label: p.provider_name,
          url: region.link || `https://www.themoviedb.org/${mediaType}/${tmdbId}/watch`,
          kind,
        });
      }
    };
    add(region.flatrate, "watch");
    add(region.free, "watch");
    add(region.ads, "watch");
    add(region.rent, "rent");
    add(region.buy, "buy");
    return links.slice(0, 8);
  } catch {
    return [];
  }
}

export function buildResourceLinks(item, watchProviders = []) {
  const q = encodeURIComponent(`${item.title} ${item.year !== "—" ? item.year : ""}`.trim());
  const links = [];

  if (item.doubanUrl) {
    links.push({ id: "douban", label: "豆瓣条目", url: item.doubanUrl, kind: "meta" });
  }
  if (item.tmdbId && item.mediaType) {
    links.push({
      id: "tmdb",
      label: "TMDB 详情",
      url: `https://www.themoviedb.org/${item.mediaType}/${item.tmdbId}`,
      kind: "meta",
    });
  }

  for (const w of watchProviders) {
    links.push(w);
  }

  links.push(
    {
      id: "bilibili",
      label: "B站搜索",
      url: `https://search.bilibili.com/all?keyword=${q}`,
      kind: "search",
    },
    {
      id: "youtube",
      label: "YouTube 搜索",
      url: `https://www.youtube.com/results?search_query=${q}`,
      kind: "search",
    },
    {
      id: "iqiyi",
      label: "爱奇艺搜索",
      url: `https://so.iqiyi.com/so/q_${q}`,
      kind: "search",
    },
  );

  const lines = [
    `${item.title}${item.year !== "—" ? ` (${item.year})` : ""}`,
    item.type ? `类型：${item.type}` : "",
    item.score ? `评分：${item.score}` : "",
    "",
    ...links.map((l) => `${l.label}：${l.url}`),
  ].filter(Boolean);

  return {
    links,
    copyText: lines.join("\n"),
  };
}

export async function enrichResult(apiKey, item) {
  let watch = [];
  if (item.tmdbId && item.mediaType) {
    watch = await fetchWatchProviders(apiKey, item.mediaType, item.tmdbId);
  }
  const { links, copyText } = buildResourceLinks(item, watch);
  return { ...item, links, copyText, watchCount: watch.length };
}
