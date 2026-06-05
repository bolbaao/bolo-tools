import axios from "axios";
import { HttpError } from "./http-error.mjs";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.payload;
}

function cacheSet(key, payload) {
  cache.set(key, { at: Date.now(), payload });
}

export function clearTrendsCache(platform) {
  if (platform) cache.delete(platform);
  else cache.clear();
}

export function formatHeat(value) {
  if (value == null || value === "") return "—";
  const raw = String(value).trim();
  if (/万|\+|亿/.test(raw)) return raw;
  const num = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(num)) return raw;
  if (num >= 100_000_000) return `${(num / 100_000_000).toFixed(1).replace(/\.0$/, "")}亿`;
  if (num >= 10_000) return `${(num / 10_000).toFixed(1).replace(/\.0$/, "")}万`;
  return String(num);
}

function douyinLabelTag(label) {
  const n = Number(label);
  if (n === 1) return "热";
  if (n === 3) return "荐";
  if (n === 5) return "新";
  return "话题";
}

async function fetchDouyinFromWeb() {
  const { data } = await axios.get(
    "https://www.douyin.com/aweme/v1/web/hot/search/list/",
    {
      timeout: 12000,
      headers: {
        "User-Agent": UA,
        Referer: "https://www.douyin.com/",
      },
      params: {
        device_platform: "webapp",
        aid: 6383,
        channel: "channel_pc_web",
        detail_list: 1,
      },
    },
  );

  const words = data?.data?.word_list || data?.word_list || [];
  const list = words.slice(0, 30).map((item, i) => ({
    rank: item.position ?? i + 1,
    title: String(item.word || "").trim(),
    heat: formatHeat(item.hot_value),
    tag: douyinLabelTag(item.label),
    url: item.word
      ? `https://www.douyin.com/search/${encodeURIComponent(item.word)}?type=general`
      : undefined,
  }));
  if (!list.length) throw new Error("empty douyin web list");
  return list;
}

async function fetchDouyinFromIes() {
  const { data } = await axios.get(
    "https://www.iesdouyin.com/web/api/v2/hotsearch/billboard/word/",
    {
      timeout: 12000,
      headers: { "User-Agent": UA, Referer: "https://www.douyin.com/" },
    },
  );

  const words = data?.word_list || [];
  const list = words.slice(0, 30).map((item, i) => ({
    rank: i + 1,
    title: String(item.word || "").trim(),
    heat: formatHeat(item.hot_value),
    tag: douyinLabelTag(item.label),
    url: item.word
      ? `https://www.douyin.com/search/${encodeURIComponent(item.word)}?type=general`
      : undefined,
  }));
  if (!list.length) throw new Error("empty douyin ies list");
  return list;
}

export async function fetchDouyinTrends({ force = false } = {}) {
  if (force) cache.delete("douyin");
  const cached = cacheGet("douyin");
  if (cached) return cached;

  let list;
  let source = "live";
  try {
    list = await fetchDouyinFromWeb();
  } catch {
    list = await fetchDouyinFromIes();
    source = "live-backup";
  }

  const payload = {
    list,
    source,
    updatedAt: new Date().toISOString(),
  };
  cacheSet("douyin", payload);
  return payload;
}

function parseInitialState(html) {
  const match = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
  if (!match) throw new Error("missing xhs initial state");
  return JSON.parse(match[1].replace(/undefined/g, "null"));
}

export async function fetchXiaohongshuTrends({ force = false } = {}) {
  if (force) cache.delete("xiaohongshu");
  const cached = cacheGet("xiaohongshu");
  if (cached) return cached;

  const { data: html } = await axios.get("https://www.xiaohongshu.com/explore", {
    timeout: 15000,
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9",
      Referer: "https://www.xiaohongshu.com/",
    },
    maxRedirects: 5,
  });

  const state = parseInitialState(html);
  const feeds = state?.feed?.feeds || [];
  const list = feeds
    .map((item, i) => {
      const card = item?.noteCard || {};
      const title = String(card.displayTitle || card.title || "").trim();
      if (!title) return null;
      const noteId = String(item?.id || "").trim();
      const type = card.type === "video" ? "视频" : "图文";
      return {
        rank: i + 1,
        title,
        heat: formatHeat(card.interactInfo?.likedCount),
        tag: type,
        author: card.user?.nickname || card.user?.nickName,
        url: noteId ? `https://www.xiaohongshu.com/explore/${noteId}` : undefined,
      };
    })
    .filter(Boolean)
    .slice(0, 30);

  if (!list.length) throw new HttpError(502, "未能解析小红书热门内容");

  const payload = {
    list,
    source: "live",
    updatedAt: new Date().toISOString(),
    notice: "展示探索页实时热门笔记（按推荐流排序）",
  };
  cacheSet("xiaohongshu", payload);
  return payload;
}

export async function fetchTrends(platform, { force = false } = {}) {
  if (platform === "douyin") return fetchDouyinTrends({ force });
  if (platform === "xiaohongshu") return fetchXiaohongshuTrends({ force });
  throw new HttpError(400, "不支持的平台");
}
