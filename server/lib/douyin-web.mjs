import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./env.mjs";
import { resolveCookiesPath } from "./video-platform.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..", "..");

/** 与微信小程序/西瓜工具一致：模拟手机端访问分享页 */
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const MOBILE_REFERER = "https://www.douyin.com/?is_from_mobile_home=1&recommend=1";

function loadCookieHeader() {
  const paths = [
    env("YTDLP_COOKIES"),
    env("DOUYIN_COOKIES"),
    "./cookies/douyin.txt",
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
      /* ignore */
    }
  }
  return null;
}

async function fetchHtml(url, cookieHeader) {
  const headers = {
    "User-Agent": MOBILE_UA,
    Referer: MOBILE_REFERER,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };
  if (cookieHeader) headers.Cookie = cookieHeader;

  const res = await fetch(url, {
    redirect: "follow",
    headers,
    signal: AbortSignal.timeout(20000),
  });
  const html = await res.text();
  return { html, finalUrl: res.url || url };
}

export function extractAwemeIdFromUrl(url) {
  try {
    const u = new URL(url);
    const modal = u.searchParams.get("modal_id") || u.searchParams.get("vid");
    if (modal && /^\d{10,22}$/.test(modal)) return modal;
    const patterns = [
      /\/video\/(\d{10,22})/i,
      /\/share\/video\/(\d{10,22})/i,
      /\/note\/(\d{10,22})/i,
    ];
    for (const re of patterns) {
      const m = u.pathname.match(re);
      if (m) return m[1];
    }
  } catch {
    /* ignore */
  }
  return null;
}

function extractAwemeIdFromHtml(html) {
  const patterns = [
    /"awemeId"\s*:\s*"(\d{10,22})"/,
    /"aweme_id"\s*:\s*"(\d{10,22})"/,
    /"itemId"\s*:\s*"(\d{10,22})"/,
    /modal_id=(\d{10,22})/,
    /\/video\/(\d{10,22})/,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return null;
}

function parseRouterData(html) {
  const m = html.match(/window\._ROUTER_DATA\s*=\s*([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    const json = JSON.parse(m[1].trim());
    const loader = json.loaderData || {};
    for (const key of Object.keys(loader)) {
      const page = loader[key];
      const items = page?.videoInfoRes?.item_list;
      if (Array.isArray(items) && items[0]) return items[0];
      if (page?.videoDetail) return page.videoDetail;
      if (page?.aweme) return page.aweme;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function parseRenderData(html, awemeId) {
  const m = html.match(/<script id="RENDER_DATA"[^>]*>([^<]+)<\/script>/);
  if (!m) return null;
  try {
    const raw = decodeURIComponent(m[1]);
    const data = JSON.parse(raw);
    const found = deepFindAwemeItem(data, awemeId);
    if (found) return found;
    const vd = data?.app?.videoDetail;
    if (vd) return typeof vd === "string" ? JSON.parse(vd) : vd;
  } catch {
    /* ignore */
  }
  return null;
}

function deepFindAwemeItem(obj, awemeId, depth = 0) {
  if (!obj || depth > 14) return null;
  if (typeof obj !== "object") return null;

  if (!Array.isArray(obj)) {
    const id = String(obj.aweme_id || obj.awemeId || obj.group_id || "");
    const hasVideo = obj.video?.play_addr || obj.video?.bitRateList || obj.bitRateList;
    if (hasVideo && (!awemeId || id === awemeId)) return obj;
    if (obj.videoDetail?.video) return obj.videoDetail;
  }

  const list = Array.isArray(obj) ? obj : Object.values(obj);
  for (const child of list) {
    const hit = deepFindAwemeItem(child, awemeId, depth + 1);
    if (hit) return hit;
  }
  return null;
}

function normalizePlayCandidates(urls) {
  return urls
    .filter((u) => u && typeof u === "string")
    .map((u) => u.replace(/playwm/g, "play"))
    .filter((u) => !/\.mp3(\?|$)/i.test(u));
}

function pickPlayUrl(item) {
  const video = item.video || item;
  const playAddr = video.play_addr || video.playAddr;
  const playList = normalizePlayCandidates([
    ...(playAddr?.url_list || []),
    ...(playAddr?.urlList || []),
  ]);

  // 默认播放地址通常已含音轨；高码率 bit_rate 常为纯视频
  if (playList.length) {
    const muxed = [...playList].sort((a, b) => scorePlayUrl(b) - scorePlayUrl(a));
    if (muxed[0]) return muxed[0];
  }

  const bitRates = video.bit_rate || video.bitRateList || item.bitRateList;
  const bitCandidates = [];
  if (Array.isArray(bitRates)) {
    for (const br of bitRates) {
      const pa = br.play_addr || br.playAddr;
      if (pa?.url_list?.[0]) bitCandidates.push(pa.url_list[0]);
      if (pa?.urlList?.[0]) bitCandidates.push(pa.urlList[0]);
      if (pa?.src) {
        bitCandidates.push(pa.src.startsWith("http") ? pa.src : `https:${pa.src}`);
      }
    }
  }

  const uri = playAddr?.uri;
  if (uri && !String(uri).includes(".mp3")) {
    bitCandidates.push(
      String(uri).startsWith("http")
        ? uri
        : `https://www.douyin.com/aweme/v1/play/?video_id=${encodeURIComponent(uri)}`,
    );
  }

  const fallback = normalizePlayCandidates(bitCandidates).sort(
    (a, b) => scorePlayUrl(b) - scorePlayUrl(a),
  );
  return fallback[0] || null;
}

function scorePlayUrl(u) {
  let s = 0;
  if (u.includes("douyinvod.com")) s += 10;
  if (u.includes("/video/")) s += 5;
  if (u.includes("aweme/v1/play")) s += 3;
  if (u.includes("ies-music") || u.includes(".mp3")) s -= 20;
  return s;
}

function itemToYtDlpInfo(item, webpageUrl) {
  const playUrl = pickPlayUrl(item);
  if (!playUrl) return null;

  const video = item.video || item;
  const author = item.author || item.authorInfo || {};
  const cover = video.cover?.url_list?.[0] || video.cover?.urlList?.[0];

  return {
    title: item.desc || item.title || "抖音视频",
    thumbnail: cover,
    duration: item.duration ?? video?.duration ?? null,
    uploader: author.nickname || author.name || "抖音",
    webpage_url: webpageUrl,
    url: playUrl,
    formats: [
      {
        format_id: "default",
        ext: /\.m3u8/i.test(playUrl) ? "m3u8" : "mp4",
        url: playUrl,
        resolution: "默认",
        vcodec: "h264",
        acodec: "aac",
      },
    ],
  };
}

/**
 * 西瓜工具类小程序同款：手机 UA 打开 iesdouyin 分享页，解析 _ROUTER_DATA / RENDER_DATA
 */
export async function extractDouyinWeb(inputUrl) {
  const cookieHeader = loadCookieHeader();

  let awemeId = extractAwemeIdFromUrl(inputUrl);
  const { html: firstHtml, finalUrl } = await fetchHtml(inputUrl, cookieHeader);
  if (!awemeId) awemeId = extractAwemeIdFromUrl(finalUrl);
  if (!awemeId) awemeId = extractAwemeIdFromHtml(firstHtml);

  const pages = [];
  if (awemeId) {
    pages.push(
      `https://www.iesdouyin.com/share/video/${awemeId}/`,
      `https://www.douyin.com/discover?modal_id=${awemeId}`,
      `https://www.douyin.com/jingxuan?modal_id=${awemeId}`,
      `https://www.douyin.com/video/${awemeId}`,
    );
  }
  if (!pages.includes(finalUrl) && finalUrl.includes("douyin")) {
    pages.unshift(finalUrl);
  }

  for (const pageUrl of pages) {
    try {
      const { html } = await fetchHtml(pageUrl, cookieHeader);
      const item =
        parseRouterData(html) || parseRenderData(html, awemeId) || null;
      if (!item) continue;
      const info = itemToYtDlpInfo(item, inputUrl);
      if (info?.url) {
        return { info, cookieSource: "web-parse" };
      }
    } catch {
      /* try next page */
    }
  }

  throw new Error(
    "未能解析该抖音链接。请粘贴完整分享链接（含 v.douyin.com 短链），并确认视频为公开可访问。",
  );
}
