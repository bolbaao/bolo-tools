import axios from "axios";
import * as cheerio from "cheerio";
import { HttpError } from "./http-error.mjs";
import { assertPublicHttpUrlResolved, normalizeWebPageInput } from "./url-guard.mjs";
import {
  detectPlatform,
  resolveFinalUrl,
  shouldResolveFinalUrl,
} from "./video-platform.mjs";
import { mapFormatsWithFallback } from "./video-formats.mjs";
import { runYtDlpJson } from "./ytdlp-runner.mjs";

const MAX_VIDEOS = 24;
const VIDEO_URL_RE = /https?:\/\/[^\s"'<>\\]+?\.(?:mp4|webm|m3u8|mov|mkv)(?:\?[^\s"'<>\\]*)?/gi;
const M3U8_URL_RE = /https?:\/\/[^\s"'<>\\]+?\.m3u8(?:\?[^\s"'<>\\]*)?/gi;

function resolveUrl(href, base) {
  const raw = String(href || "").trim();
  if (!raw) return "";
  if (raw.startsWith("data:") || raw.startsWith("blob:")) return "";
  try {
    return new URL(raw, base).href;
  } catch {
    return "";
  }
}

function guessType(url) {
  const u = String(url || "").toLowerCase();
  if (u.includes(".m3u8")) return "m3u8";
  if (u.includes(".webm")) return "webm";
  if (u.includes(".mov")) return "mov";
  if (u.includes(".mkv")) return "mkv";
  return "mp4";
}

function addVideo(map, entry) {
  const url = String(entry.url || "").trim();
  if (!url || !/^https?:\/\//i.test(url)) return;
  const key = url.split("#")[0];
  if (map.has(key)) return;
  map.set(key, {
    label: entry.label || "视频",
    url,
    type: entry.type || guessType(url),
    source: entry.source || "page",
  });
}

function scanTextForVideos(text, baseUrl, map) {
  if (!text) return;
  for (const re of [VIDEO_URL_RE, M3U8_URL_RE]) {
    re.lastIndex = 0;
    for (const match of text.matchAll(re)) {
      const resolved = resolveUrl(match[0], baseUrl);
      if (!resolved) continue;
      addVideo(map, {
        label: resolved.includes(".m3u8") ? "HLS 流" : "页面视频地址",
        url: resolved,
        source: "script",
      });
    }
  }
}

/**
 * @param {string} rawUrl
 */
export async function extractVideosFromWebPage(rawUrl) {
  const input = normalizeWebPageInput(rawUrl);
  if (!input) throw new HttpError(400, "请提供网页地址");

  let safeUrl;
  try {
    safeUrl = await assertPublicHttpUrlResolved(input);
  } catch (e) {
    if (e instanceof Error && e.message === "URL 格式无效") {
      throw new HttpError(400, "网页地址格式无效，请填写完整链接，如 https://example.com/page");
    }
    throw e;
  }
  const { data: html } = await axios.get(safeUrl, {
    timeout: 20000,
    maxContentLength: 3 * 1024 * 1024,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
    responseType: "text",
  });

  const $ = cheerio.load(html);
  const pageTitle = $("title").first().text().trim() || safeUrl;
  const videos = new Map();

  $("video[src]").each((_, el) => {
    const src = resolveUrl($(el).attr("src"), safeUrl);
    if (src) addVideo(videos, { label: "页面 <video>", url: src, source: "video" });
  });

  $("video source[src], source[src]").each((_, el) => {
    const src = resolveUrl($(el).attr("src"), safeUrl);
    if (!src) return;
    const typeAttr = String($(el).attr("type") || "").trim();
    addVideo(videos, {
      label: typeAttr ? `视频源 (${typeAttr})` : "视频源",
      url: src,
      source: "source",
    });
  });

  for (const sel of [
    'meta[property="og:video"]',
    'meta[property="og:video:secure_url"]',
    'meta[property="og:video:url"]',
    'meta[name="twitter:player:stream"]',
  ]) {
    const content = $(sel).attr("content");
    const resolved = resolveUrl(content, safeUrl);
    if (resolved) {
      addVideo(videos, { label: "页面元信息视频", url: resolved, source: "meta" });
    }
  }

  $("iframe[src]").each((_, el) => {
    const src = resolveUrl($(el).attr("src"), safeUrl);
    if (!src) return;
    if (/youtube|youtu\.be|bilibili|vimeo|douyin|tiktok|facebook|twitter|x\.com|weixin|qq\.com/i.test(src)) {
      addVideo(videos, { label: "嵌入播放器（需用分享链接提取）", url: src, type: "embed", source: "iframe" });
    }
  });

  const scriptText = $("script")
    .map((_, el) => $(el).html() || "")
    .get()
    .join("\n");
  scanTextForVideos(scriptText, safeUrl, videos);
  scanTextForVideos($.html(), safeUrl, videos);

  let ytdlp = null;
  try {
    let pageForYtdlp = safeUrl;
    let platform = detectPlatform(safeUrl);
    if (shouldResolveFinalUrl(safeUrl, platform)) {
      pageForYtdlp = await resolveFinalUrl(safeUrl, platform);
      platform = detectPlatform(pageForYtdlp);
    }
    const info = await runYtDlpJson(pageForYtdlp, platform);
    const formats = mapFormatsWithFallback(info, platform);
    if (formats.length) {
      ytdlp = {
        platform,
        title: info.title || pageTitle,
        pageUrl: pageForYtdlp,
        thumbnail: info.thumbnail,
        duration: info.duration,
        formats,
      };
    }
  } catch {
    /* yt-dlp 为可选增强 */
  }

  const list = [...videos.values()].slice(0, MAX_VIDEOS);
  if (!list.length && !ytdlp?.formats?.length) {
    throw new HttpError(
      404,
      "未在该网页中找到可下载的视频。若页面使用平台播放器，请复制视频分享链接到「视频链接提取」。",
    );
  }

  return {
    ok: true,
    pageTitle,
    pageUrl: safeUrl,
    videos: list,
    ytdlp,
  };
}
