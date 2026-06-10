import axios from "axios";
import * as cheerio from "cheerio";
import { searchWeb, getWebSearchCapabilities } from "./web-search.mjs";
import { searchXiaohongshuNotes } from "./xiaohongshu-image-search.mjs";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const CN_REGION = { id: "cn", label: "中国", gl: "cn", hl: "zh-cn", tavilyCountry: "cn" };

export const MEDIA_PLATFORMS = {
  douyin: { id: "douyin", label: "抖音", siteFilter: "douyin.com" },
  xiaohongshu: { id: "xiaohongshu", label: "小红书", siteFilter: "xiaohongshu.com" },
  wechat: { id: "wechat", label: "微信公众号", siteFilter: "mp.weixin.qq.com" },
};

export const MEDIA_PLATFORM_IDS = Object.keys(MEDIA_PLATFORMS);

/** @param {unknown} raw */
export function parseMediaPlatforms(raw) {
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,，\s]+/) : [];
  const picked = list
    .map((id) => String(id || "").trim())
    .filter((id) => MEDIA_PLATFORM_IDS.includes(id));
  return picked.length ? picked : [...MEDIA_PLATFORM_IDS];
}

function stripPlatformWords(query) {
  return String(query || "")
    .replace(/小红书|xiaohongshu|xhs|抖音|douyin|微信|wechat|公众号|微信公众号/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toResult(item) {
  const url = String(item.url || "").trim();
  if (!url) return null;
  return {
    title: String(item.title || "未命名").trim() || "未命名",
    url,
    snippet: String(item.snippet || "").trim().slice(0, 600),
    platform: item.platform,
    platformLabel: item.platformLabel,
  };
}

function dedupeResults(results = []) {
  const seen = new Set();
  const out = [];
  for (const item of results) {
    const url = String(item?.url || "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const normalized = toResult(item);
    if (normalized) out.push(normalized);
  }
  return out;
}

/**
 * @param {string} query
 */
async function searchDouyinMedia(query) {
  const keyword = stripPlatformWords(query);
  if (!keyword || !getWebSearchCapabilities().available) return [];

  try {
    const payload = await searchWeb(`${keyword} site:douyin.com`, {
      depth: "basic",
      maxResults: 8,
      region: CN_REGION,
    });
    return (payload.results || [])
      .filter((r) => /douyin\.com|iesdouyin\.com/i.test(r.url || ""))
      .map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet || `${r.title} · 抖音`,
        platform: "douyin",
        platformLabel: "抖音",
      }));
  } catch {
    return [];
  }
}

/**
 * @param {string} query
 */
async function searchXiaohongshuMedia(query) {
  const keyword = stripPlatformWords(query);
  if (!keyword) return [];

  try {
    const notes = await searchXiaohongshuNotes(keyword);
    return notes.map((n) => ({
      title: n.title || "小红书笔记",
      url: n.pageUrl || n.url,
      snippet: n.desc || `${n.title || "小红书笔记"} · 小红书`,
      platform: "xiaohongshu",
      platformLabel: "小红书",
    }));
  } catch {
    return [];
  }
}

/**
 * 搜狗微信：搜公众号文章
 * @param {string} query
 */
async function searchWechatMedia(query) {
  const keyword = stripPlatformWords(query);
  if (!keyword) return [];

  try {
    const { data: html } = await axios.get("https://weixin.sogou.com/weixin", {
      params: { type: 2, query: keyword, ie: "utf8" },
      headers: {
        "User-Agent": UA,
        Referer: "https://weixin.sogou.com/",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
      timeout: 15000,
    });

    const $ = cheerio.load(html);
    const out = [];
    const seen = new Set();

    $("li, .news-box, .txt-box").each((_, el) => {
      const titleEl = $(el).find("h3 a, .txt-box h3 a, .tit a, h4 a").first();
      const title = titleEl.text().trim();
      if (!title || title.length < 2) return;

      const href = titleEl.attr("href");
      if (!href) return;

      const pageUrl = href.startsWith("http") ? href : `https://weixin.sogou.com${href}`;
      if (seen.has(pageUrl)) return;
      seen.add(pageUrl);

      const snippet =
        $(el).find("p.txt-info, .txt-info, .s2").first().text().trim() ||
        `${title} · 微信公众号`;

      out.push({
        title,
        url: pageUrl,
        snippet: snippet.slice(0, 600),
        platform: "wechat",
        platformLabel: "微信公众号",
      });
    });

    if (out.length) return out.slice(0, 8);
  } catch {
    /* fallback below */
  }

  if (!getWebSearchCapabilities().available) return [];

  try {
    const payload = await searchWeb(`${keyword} site:mp.weixin.qq.com`, {
      depth: "basic",
      maxResults: 6,
      region: CN_REGION,
    });
    return (payload.results || [])
      .filter((r) => /mp\.weixin\.qq\.com|weixin\.sogou\.com/i.test(r.url || ""))
      .map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet || `${r.title} · 微信公众号`,
        platform: "wechat",
        platformLabel: "微信公众号",
      }));
  } catch {
    return [];
  }
}

const SEARCHERS = {
  douyin: searchDouyinMedia,
  xiaohongshu: searchXiaohongshuMedia,
  wechat: searchWechatMedia,
};

/**
 * 跨抖音 / 小红书 / 微信公众号检索
 * @param {string} query
 * @param {{ platforms?: string[] }} opts
 */
export async function searchMediaPlatforms(query, opts = {}) {
  const keyword = String(query || "").trim();
  if (!keyword) {
    return { query: "", searchQuery: "", results: [], platforms: [], provider: "media" };
  }

  const platforms = parseMediaPlatforms(opts.platforms);
  const chunks = await Promise.all(
    platforms.map(async (id) => {
      const fn = SEARCHERS[id];
      if (!fn) return [];
      try {
        return await fn(keyword);
      } catch {
        return [];
      }
    }),
  );

  const results = dedupeResults(chunks.flat());

  return {
    query: keyword,
    searchQuery: keyword,
    searchVariants: platforms.map(
      (id) => `${keyword} ${MEDIA_PLATFORMS[id]?.label || id}`,
    ),
    understanding: `在${platforms.map((id) => MEDIA_PLATFORMS[id]?.label || id).join("、")}中检索「${keyword}」`,
    results,
    platforms,
    provider: "media",
    topic: "general",
    planned: false,
    mode: "media",
    modeLabel: "媒体搜索",
    region: CN_REGION,
    recencyIntent: false,
    queriesUsed: platforms.map((id) => `${keyword} · ${MEDIA_PLATFORMS[id]?.label}`),
  };
}
