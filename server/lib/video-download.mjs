import { URL } from "url";
import { assertPublicHttpUrl } from "./url-guard.mjs";
import {
  DESKTOP_UA,
  loadCookieHeaderForPlatform,
  MOBILE_UA,
  PLATFORM_REFERERS,
} from "./video-platform.mjs";

/** 允许代理下载的 CDN 域名（防 SSRF） */
const ALLOWED_HOST_SUFFIXES = [
  "finder.video.qq.com",
  "wxapp.tc.qq.com",
  "video.qq.com",
  "qpic.cn",
  "wxqlogo.cn",
  "douyinvod.com",
  "douyinstatic.com",
  "douyin.com",
  "iesdouyin.com",
  "snssdk.com",
  "bytecdn.cn",
  "tiktokcdn.com",
  "tiktokv.com",
  "amemv.com",
  "bilivideo.com",
  "bilivideo.cn",
  "hdslb.com",
  "mcdn.bilivideo.cn",
  "googlevideo.com",
  "youtube.com",
  "ytimg.com",
  "video.twimg.com",
  "twimg.com",
  "pbs.twimg.com",
  "cdninstagram.com",
  "fbcdn.net",
  "facebook.com",
  "redd.it",
  "v.redd.it",
  "redditmedia.com",
  "vimeo.com",
  "vimeocdn.com",
  "pinimg.com",
  "telegra.ph",
  "cdn.telegram.org",
  "telesco.pe",
  "twitch.tv",
  "ttvnw.net",
  "jtvnw.net",
  "linkedin.com",
  "licdn.com",
  "snapchat.com",
  "sc-cdn.net",
];

export function isAllowedMediaUrl(raw) {
  let parsed;
  try {
    parsed = new URL(assertPublicHttpUrl(raw));
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

/** 网页直链视频：允许公网 HTTP(S)，由下载代理携带 Referer */
export function isAllowedWebPageMediaUrl(raw) {
  try {
    assertPublicHttpUrl(raw);
    return true;
  } catch {
    return false;
  }
}

export function buildWebPageProxyHeaders(pageUrl, mediaUrl) {
  const headers = {
    "User-Agent": DESKTOP_UA,
    Accept: "*/*",
  };
  const referer = String(pageUrl || mediaUrl || "").trim();
  if (referer) {
    try {
      headers.Referer = referer;
      headers.Origin = new URL(referer).origin;
    } catch {
      headers.Referer = referer;
    }
  }
  return headers;
}

export function buildProxyHeaders(platform, sourceUrl) {
  const headers = {
    "User-Agent": DESKTOP_UA,
    Accept: "*/*",
  };
  if (platform === "douyin") {
    headers["User-Agent"] = MOBILE_UA;
    headers.Referer = "https://www.douyin.com/";
    headers.Origin = "https://www.douyin.com";
  } else if (platform === "weixin-channels") {
    headers["User-Agent"] = MOBILE_UA;
    headers.Referer = "https://channels.weixin.qq.com/";
  } else if (PLATFORM_REFERERS[platform]) {
    headers.Referer = PLATFORM_REFERERS[platform];
  } else {
    try {
      const u = new URL(sourceUrl);
      headers.Referer = `${u.protocol}//${u.host}/`;
    } catch {
      /* ignore */
    }
  }
  const cookie = loadCookieHeaderForPlatform(platform);
  if (cookie) headers.Cookie = cookie;
  return headers;
}

export function safeFilename(name, ext = "mp4") {
  const base = String(name || "video")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  const safeExt = ext.replace(/[^a-z0-9]/gi, "") || "mp4";
  return `${base || "video"}.${safeExt}`;
}

export { MOBILE_UA };
