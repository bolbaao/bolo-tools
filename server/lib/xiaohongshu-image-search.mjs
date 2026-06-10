import axios from "axios";
import fs from "fs";
import { env } from "./env.mjs";
import { resolveCookiesPath } from "./video-platform.mjs";
import { parseInitialState } from "./xiaohongshu-state.mjs";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const SEARCH_API = "https://edith.xiaohongshu.com/api/sns/web/v1/search/notes";

function loadCookieHeader() {
  const paths = [
    env("XHS_COOKIES"),
    env("XIAOHONGSHU_COOKIES"),
    "./cookies/xiaohongshu.txt",
  ];
  for (const p of paths) {
    const resolved = resolveCookiesPath(p);
    if (!resolved) continue;
    try {
      const lines = fs.readFileSync(resolved, "utf8").split("\n");
      const pairs = [];
      for (const line of lines) {
        if (!line || line.startsWith("#")) continue;
        const parts = line.split("\t");
        if (parts.length >= 7 && parts[5] && parts[6]) {
          pairs.push(`${parts[5]}=${parts[6]}`);
        }
      }
      if (pairs.length) return pairs.join("; ");
    } catch {
      /* try next */
    }
  }
  return "";
}

export function xiaohongshuImageSearchReady() {
  return Boolean(loadCookieHeader());
}

function pickCoverUrl(cover) {
  if (!cover) return null;
  const list = cover.infoList || cover.info_list || [];
  const dft = list.find(
    (item) => item.imageScene === "WB_DFT" || item.image_scene === "WB_DFT",
  );
  if (dft?.url) return dft.url;
  const fallback = list.find((item) => item.url && !/prv/i.test(item.url));
  if (fallback?.url) return fallback.url;
  return cover.urlDefault || cover.url || list[0]?.url || null;
}

function normalizeNoteImage(note, pageUrl) {
  const card = note?.note_card || note?.noteCard || note;
  const title = String(card.display_title || card.displayTitle || card.title || "").trim();
  const cover = card.cover || card.image_list?.[0] || card.imageList?.[0];
  const imageUrl = pickCoverUrl(cover);
  if (!imageUrl) return null;
  const noteId = String(note.id || card.note_id || card.noteId || "").trim();
  const link = noteId ? `https://www.xiaohongshu.com/explore/${noteId}` : pageUrl;
  return {
    url: imageUrl.startsWith("http") ? imageUrl : `https:${imageUrl}`,
    title,
    pageUrl: link,
    domain: "xiaohongshu.com",
    score: 8,
    source: "xiaohongshu",
  };
}

function parseSearchItems(data) {
  const root = data?.data || data;
  const buckets = [
    root?.items,
    root?.notes,
    root?.note_list,
    root?.noteList,
    data?.items,
  ];
  for (const bucket of buckets) {
    if (Array.isArray(bucket) && bucket.length) return bucket;
  }
  return [];
}

async function searchXiaohongshuApi(keyword) {
  const cookie = loadCookieHeader();
  if (!cookie) return [];

  const { data } = await axios.post(
    SEARCH_API,
    {
      keyword,
      page: 1,
      page_size: 20,
      search_type: 0,
      sort: "general",
      note_type: 0,
    },
    {
      timeout: 15000,
      headers: {
        "User-Agent": UA,
        Referer: "https://www.xiaohongshu.com/",
        Origin: "https://www.xiaohongshu.com",
        "Content-Type": "application/json",
        Cookie: cookie,
      },
    },
  );

  if (!data?.success && data?.code !== 0) return [];

  return parseSearchItems(data)
    .map((item) => normalizeNoteImage(item))
    .filter(Boolean);
}

function keywordTokens(keyword) {
  return String(keyword || "")
    .toLowerCase()
    .replace(/小红书|图片|配图|logo|标志|商标|图标/gi, " ")
    .split(/[\s,，、/]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

async function searchXiaohongshuExplore(keyword) {
  const tokens = keywordTokens(keyword);
  if (!tokens.length) return [];

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
  const out = [];

  for (const item of feeds) {
    const card = item?.noteCard || item?.note_card || {};
    const title = String(card.displayTitle || card.display_title || card.title || "").trim();
    if (!title) continue;
    const hay = title.toLowerCase();
    if (!tokens.some((t) => hay.includes(t.toLowerCase()))) continue;
    const image = normalizeNoteImage(
      { note_card: card, id: item.id },
      item.id ? `https://www.xiaohongshu.com/explore/${item.id}` : undefined,
    );
    if (image) out.push({ ...image, score: 5, source: "xiaohongshu" });
  }

  return out;
}

/**
 * @param {string} query
 * @returns {Promise<Array<{ title: string, url: string, pageUrl?: string, desc?: string }>>}
 */
export async function searchXiaohongshuNotes(query) {
  const keyword = String(query || "")
    .replace(/小红书|xiaohongshu|xhs/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!keyword) return [];

  const apiResults = await searchXiaohongshuApi(keyword).catch(() => []);
  const fromApi = apiResults
    .map((item) => ({
      title: item.title || "小红书笔记",
      url: item.pageUrl || item.url,
      pageUrl: item.pageUrl || item.url,
      desc: `${item.title || "小红书笔记"} · 小红书`,
    }))
    .filter((item) => item.url);

  if (fromApi.length) return fromApi;

  const exploreResults = await searchXiaohongshuExplore(keyword).catch(() => []);
  return exploreResults
    .map((item) => ({
      title: item.title || "小红书笔记",
      url: item.pageUrl || item.url,
      pageUrl: item.pageUrl || item.url,
      desc: `${item.title || "小红书笔记"} · 小红书`,
    }))
    .filter((item) => item.url);
}

/**
 * @param {string} query
 */
export async function searchXiaohongshuImages(query) {
  const keyword = String(query || "")
    .replace(/小红书|xiaohongshu|xhs/gi, " ")
    .replace(/\s*(logo|标志|商标|图标|icon)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!keyword) return [];

  const apiResults = await searchXiaohongshuApi(keyword).catch(() => []);
  if (apiResults.length) return apiResults;

  return searchXiaohongshuExplore(keyword).catch(() => []);
}
