import * as cheerio from "cheerio";
import axios from "axios";
import { env } from "./env.mjs";
import { assertPublicHttpUrlResolved } from "./url-guard.mjs";
import { searchWeb, getWebSearchCapabilities } from "./web-search.mjs";
import { extractDouyinWeb, extractAwemeIdFromUrl } from "./douyin-web.mjs";
import { stripImageSearchNoise, titleMatchesSubject, platformSearchKeyword } from "./image-search-query.mjs";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 20_000;

/** @typedef {'xiaohongshu'|'douyin'|'taobao'|'meituan'|'wechat'} ImagePlatformId */

export const IMAGE_PLATFORMS = {
  xiaohongshu: {
    id: "xiaohongshu",
    label: "小红书",
    domains: /xhscdn|xiaohongshu/i,
    siteFilter: "xiaohongshu.com",
    searchHint: "小红书",
  },
  douyin: {
    id: "douyin",
    label: "抖音",
    domains: /douyin|douyinvod|iesdouyin|douyinpic|amemv|snssdk/i,
    siteFilter: "douyin.com",
    searchHint: "抖音",
  },
  taobao: {
    id: "taobao",
    label: "淘宝",
    domains: /taobao|tmall|alicdn/i,
    siteFilter: "taobao.com",
    searchHint: "淘宝",
  },
  meituan: {
    id: "meituan",
    label: "美团",
    domains: /meituan\.(com|net)/i,
    siteFilter: "meituan.com",
    searchHint: "美团",
  },
  wechat: {
    id: "wechat",
    label: "微信公众号",
    domains: /mp\.weixin\.qq\.com|mmbiz\.qpic|wx\.qlogo/i,
    siteFilter: "mp.weixin.qq.com",
    searchHint: "微信公众号",
  },
};

export const IMAGE_PLATFORM_IDS = Object.keys(IMAGE_PLATFORMS);

function normalizeCandidate(url, meta = {}) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return null;
  try {
    const href = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
    const parsed = new URL(href);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return {
      url: parsed.toString(),
      title: String(meta.title || "").trim(),
      pageUrl: String(meta.pageUrl || meta.link || "").trim() || undefined,
      domain: String(meta.domain || parsed.hostname || "").trim(),
      score: Number(meta.score) || 0,
      source: meta.source || undefined,
    };
  } catch {
    return null;
  }
}

function stripPlatformWords(query) {
  return String(query || "")
    .replace(/小红书|xiaohongshu|xhs|抖音|douyin|淘宝|taobao|tmall|天猫|美团|meituan|微信|wechat|公众号|微信公众号/gi, " ")
    .replace(/\s*(logo|标志|商标|图标|icon)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} text
 * @returns {ImagePlatformId[]}
 */
export function detectImagePlatforms(text) {
  const msg = String(text || "");
  const out = new Set();
  if (/小红书|xiaohongshu|xhs/i.test(msg)) out.add("xiaohongshu");
  if (/抖音|douyin/i.test(msg)) out.add("douyin");
  if (/淘宝|taobao|天猫|tmall/i.test(msg)) out.add("taobao");
  if (/美团|meituan/i.test(msg)) out.add("meituan");
  if (/微信|wechat|公众号/i.test(msg)) out.add("wechat");
  return [...out];
}

/**
 * @param {unknown} value
 * @returns {ImagePlatformId[]}
 */
export function normalizePlatformIds(value) {
  const arr = Array.isArray(value) ? value : String(value || "").split(/[,，\s|/]+/);
  const out = new Set();
  for (const raw of arr) {
    const p = String(raw || "").trim().toLowerCase();
    if (!p) continue;
    if (/小红书|xhs|xiaohongshu/.test(p)) out.add("xiaohongshu");
    if (/抖音|douyin/.test(p)) out.add("douyin");
    if (/淘宝|taobao|tmall|天猫/.test(p)) out.add("taobao");
    if (/美团|meituan/.test(p)) out.add("meituan");
    if (/微信|wechat|公众号/.test(p)) out.add("wechat");
    if (IMAGE_PLATFORMS[p]) out.add(p);
  }
  return [...out];
}

export function platformReferer(url) {
  if (/xhscdn|xiaohongshu/i.test(url)) return "https://www.xiaohongshu.com/";
  if (/douyin|douyinvod|douyinpic|iesdouyin/i.test(url)) return "https://www.douyin.com/";
  if (/mmbiz\.qpic|mp\.weixin/i.test(url)) return "https://mp.weixin.qq.com/";
  if (/alicdn|taobao|tmall/i.test(url)) return "https://www.taobao.com/";
  if (/meituan/i.test(url)) return "https://www.meituan.com/";
  return undefined;
}

export function isPlatformImageSource(meta = {}, platformId) {
  const text = `${meta.domain || ""} ${meta.pageUrl || ""} ${meta.url || ""} ${meta.source || ""}`;
  if (platformId) {
    const cfg = IMAGE_PLATFORMS[platformId];
    return cfg ? cfg.domains.test(text) : false;
  }
  return IMAGE_PLATFORM_IDS.some((id) => isPlatformImageSource(meta, id));
}

function resolveWechatImageUrl(thumb) {
  const raw = String(thumb || "").trim();
  if (!raw) return null;
  if (/mmbiz\.qpic|wx\.qlogo/i.test(raw)) {
    return raw.startsWith("//") ? `https:${raw}` : raw;
  }
  try {
    const href = raw.startsWith("//") ? `https:${raw}` : raw;
    const u = new URL(href);
    const inner = u.searchParams.get("url");
    if (inner) {
      const decoded = decodeURIComponent(inner);
      return decoded.startsWith("http") ? decoded : `https:${decoded}`;
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function extractOgImageFromPage(pageUrl, meta = {}) {
  try {
    const safe = await assertPublicHttpUrlResolved(pageUrl);
    const referer = platformReferer(safe) || safe;
    const res = await fetch(safe, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        Referer: referer,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);
    const og =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      $('link[rel="image_src"]').attr("href");
    if (!og) return null;
    return normalizeCandidate(new URL(og, safe).href, {
      title: meta.title || $("title").first().text().trim(),
      pageUrl: safe,
      domain: new URL(safe).hostname,
      score: meta.score ?? 4,
      source: meta.source,
    });
  } catch {
    return null;
  }
}

async function searchSerperSiteImages(query, siteFilter, maxResults = 8) {
  const apiKey = env("SERPER_API_KEY");
  if (!apiKey) return [];

  const q = siteFilter ? `${query} site:${siteFilter}` : query;
  try {
    const res = await fetch("https://google.serper.dev/images", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        q,
        num: Math.min(12, Math.max(3, maxResults)),
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return [];
    return (data.images || [])
      .map((item) =>
        normalizeCandidate(item.imageUrl || item.thumbnailUrl, {
          title: item.title,
          pageUrl: item.link,
          domain: item.domain,
          score: 5,
          source: siteFilter?.split(".")[0],
        }),
      )
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function searchWebSiteImages(query, siteFilter, source, maxPages = 4) {
  if (!getWebSearchCapabilities().available) return [];
  const keyword = stripPlatformWords(query);
  if (!keyword) return [];

  try {
    const hint = siteFilter ? `${keyword} site:${siteFilter}` : `${keyword} ${source || ""}`.trim();
    const payload = await searchWeb(hint, { depth: "basic", maxResults: maxPages });
    const out = [];
    for (const item of payload.results || []) {
      const og = await extractOgImageFromPage(item.url, {
        title: item.title,
        score: 5,
        source,
      });
      if (og) out.push(og);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * 搜狗微信搜索：抓取公众号文章配图
 * @param {string} query
 */
export async function searchWechatOfficialImages(query) {
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

    $("li").each((_, el) => {
      const title =
        $(el).find("h3 a, .txt-box h3 a, .tit a").first().text().trim() ||
        $(el).find("h4 a").first().text().trim();
      if (!title || title.length < 2) return;
      if (!titleMatchesSubject(title, keyword)) return;

      const thumb =
        $(el).find("img").attr("src") ||
        $(el).find("img").attr("data-src") ||
        $(el).find("img").attr("data-original");
      const imageUrl = resolveWechatImageUrl(thumb);
      if (!imageUrl) return;

      const key = imageUrl.split("?")[0];
      if (seen.has(key)) return;
      seen.add(key);

      const link = $(el).find("h3 a, .txt-box h3 a, .tit a").first().attr("href");
      const pageUrl = link
        ? link.startsWith("http")
          ? link
          : `https://weixin.sogou.com${link}`
        : undefined;

      const candidate = normalizeCandidate(imageUrl, {
        title,
        pageUrl,
        domain: "mp.weixin.qq.com",
        score: 8,
        source: "wechat",
      });
      if (candidate) out.push(candidate);
    });

    return out.slice(0, 12);
  } catch {
    return [];
  }
}

function isDouyinContentUrl(url) {
  return /douyin\.com\/(?:video|share\/video|note)|iesdouyin\.com\/share\/video/i.test(String(url || ""));
}

/**
 * 抖音：Tavily 找视频页 → 解析封面图
 * @param {string} query
 */
export async function searchDouyinImages(query, subject = "") {
  const keyword = platformSearchKeyword(query, subject);
  if (!keyword || !getWebSearchCapabilities().available) return [];

  try {
    const payload = await searchWeb(`${keyword} site:douyin.com`, {
      depth: "basic",
      maxResults: 8,
    });
    const out = [];
    const seen = new Set();

    for (const item of payload.results || []) {
      const pageUrl = String(item.url || "").trim();
      if (!isDouyinContentUrl(pageUrl)) continue;
      try {
        const { info } = await extractDouyinWeb(pageUrl);
        const thumb = info?.thumbnail;
        if (!thumb) continue;
        const title = String(info.title || item.title || "").trim();
        if (!titleMatchesSubject(title, keyword)) continue;
        const key = thumb.split("?")[0];
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(
          normalizeCandidate(thumb, {
            title,
            pageUrl: info.webpage_url || pageUrl,
            domain: "douyin.com",
            score: 12,
            source: "douyin",
          }),
        );
      } catch {
        /* try next video */
      }
    }

    if (out.length) return out.filter(Boolean);

    for (const item of payload.results || []) {
      const pageUrl = String(item.url || "").trim();
      const awemeId = extractAwemeIdFromUrl(pageUrl);
      if (!awemeId) continue;
      const shareUrl = `https://www.iesdouyin.com/share/video/${awemeId}/`;
      try {
        const { info } = await extractDouyinWeb(shareUrl);
        const thumb = info?.thumbnail;
        if (!thumb) continue;
        const title = String(info.title || item.title || "").trim();
        if (!titleMatchesSubject(title, keyword)) continue;
        const key = thumb.split("?")[0];
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(
          normalizeCandidate(thumb, {
            title,
            pageUrl: shareUrl,
            domain: "douyin.com",
            score: 10,
            source: "douyin",
          }),
        );
      } catch {
        /* next */
      }
    }

    return out.filter(Boolean).slice(0, 10);
  } catch {
    return [];
  }
}

async function searchSitePlatformImages(platformId, query) {
  const cfg = IMAGE_PLATFORMS[platformId];
  if (!cfg) return [];

  const keyword = stripPlatformWords(query);
  if (!keyword) return [];

  const serper = await searchSerperSiteImages(keyword, cfg.siteFilter, 10);
  if (serper.length) return serper.map((item) => ({ ...item, source: platformId, score: item.score + 2 }));

  const web = await searchWebSiteImages(keyword, cfg.siteFilter, platformId, 5);
  if (web.length) return web;

  if (platformId === "douyin") {
    const covers = await searchDouyinImages(keyword);
    if (covers.length) return covers;
    const hintResults = await searchSerperSiteImages(`${keyword} ${cfg.searchHint}`, "", 8);
    return hintResults
      .filter((item) => cfg.domains.test(`${item.domain || ""} ${item.url || ""}`))
      .map((item) => ({ ...item, source: "douyin", score: (item.score || 0) + 3 }));
  }

  if (platformId === "taobao") {
    return searchSerperSiteImages(keyword, "tmall.com", 6).then((items) =>
      items.map((item) => ({ ...item, source: "taobao", score: (item.score || 0) + 2 })),
    );
  }

  return [];
}

/**
 * @param {ImagePlatformId} platformId
 * @param {string} query
 */
export async function searchPlatformImages(platformId, query) {
  if (platformId === "wechat") return searchWechatOfficialImages(query);
  return searchSitePlatformImages(platformId, query);
}

/**
 * @param {string} query
 * @param {ImagePlatformId[]} [platformIds]
 */
export async function searchMultiPlatformImages(query, platformIds = []) {
  const ids = normalizePlatformIds(platformIds);
  if (!ids.length) return [];

  const buckets = await Promise.all(ids.map((id) => searchPlatformImages(id, query)));
  const seen = new Set();
  const merged = [];

  for (const list of buckets) {
    for (const item of list) {
      const key = item.url.split("?")[0];
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }

  return merged;
}

export function buildPlatformSearchVariants(subject, platformIds = []) {
  const core = String(subject || "").trim();
  if (!core) return [];
  const ids = normalizePlatformIds(platformIds);
  const variants = [];
  for (const id of ids) {
    const cfg = IMAGE_PLATFORMS[id];
    if (cfg) variants.push(`${core} ${cfg.searchHint} 高清配图`);
  }
  return [...new Set(variants)];
}
