import { env } from "./env.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { formatWeixinChannelsError } from "../../shared/public-error.mjs";
import { MOBILE_UA } from "./video-download.mjs";
import { refreshYuanbaoCookies } from "./refresh-yuanbao-cookies.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..", "..");

function resolveCookieFile(raw) {
  if (!raw) return null;
  const p = raw.startsWith("~")
    ? path.join(process.env.HOME || "", raw.slice(1))
    : path.isAbsolute(raw)
      ? raw
      : path.join(PROJECT_ROOT, raw);
  return fs.existsSync(p) ? p : null;
}

/** 读取元宝 Cookie：YUANBAO_SPH_COOKIE 或 YUANBAO_SPH_COOKIES 文件 */
export function loadYuanbaoCookie() {
  const inline = env("YUANBAO_SPH_COOKIE");
  if (inline) return inline.trim();

  const filePath = resolveCookieFile(env("YUANBAO_SPH_COOKIES") || "./cookies/yuanbao.txt");
  if (!filePath) return "";

  try {
    return fs.readFileSync(filePath, "utf8").trim().split("\n")[0].trim();
  } catch {
    return "";
  }
}

const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/** 从分享文案/链接解析视频号 URL 与 oid/nid/eid/token */
function isWeixinChannelsHost(hostname, pathname = "") {
  if (/channels\.weixin\.qq\.com|finder\.video\.qq\.com|wxapp\.tc\.qq\.com|weixin110\.qq\.com/i.test(hostname)) {
    return true;
  }
  if (/^weixin\.qq\.com$/i.test(hostname) && /\/sph|\/r\/|video|finder/i.test(pathname)) {
    return true;
  }
  return false;
}

export function parseWeixinChannelsInput(raw) {
  let text = String(raw ?? "").trim();
  if (!text) return null;

  const urlMatch = text.match(/https?:\/\/[^\s<>"'\u4e00-\u9fff]+/i);
  if (urlMatch) {
    text = urlMatch[0].replace(/[，。；,.;!?！？]+$/, "");
  } else if (/channels\.weixin\.qq\.com|weixin\.qq\.com|weixin110\.qq\.com/i.test(text)) {
    text = `https://${text.replace(/^\/+/, "")}`;
  }

  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    return null;
  }

  if (!isWeixinChannelsHost(parsed.hostname, parsed.pathname)) {
    return null;
  }

  const oid =
    parsed.searchParams.get("oid") ||
    parsed.searchParams.get("objectId") ||
    parsed.searchParams.get("feedid") ||
    parsed.searchParams.get("feedId") ||
    parsed.searchParams.get("id") ||
    parsed.searchParams.get("vid");
  const nid =
    parsed.searchParams.get("nid") ||
    parsed.searchParams.get("nonceId") ||
    parsed.searchParams.get("nonceid") ||
    parsed.searchParams.get("objectNonceId");
  const exportKey = parsed.searchParams.get("exportkey") || parsed.searchParams.get("exportKey");
  const eid = parsed.searchParams.get("eid") || parsed.searchParams.get("exportId");
  const token = parsed.searchParams.get("token");

  return {
    shareUrl: parsed.toString(),
    oid,
    nid,
    exportKey,
    eid,
    token,
  };
}

function generateRid() {
  const ts = Math.floor(Date.now() / 1000).toString(16);
  const rand = Array.from({ length: 8 }, () =>
    "0123456789abcdef"[Math.floor(Math.random() * 16)],
  ).join("");
  return `${ts}-${rand}`;
}

function cleanVideoUrl(videoUrl) {
  if (!videoUrl) return "";
  try {
    const u = new URL(videoUrl);
    const encfilekey = u.searchParams.get("encfilekey");
    const token = u.searchParams.get("token");
    if (encfilekey && token) {
      return `${u.protocol}//${u.host}${u.pathname}?encfilekey=${encfilekey}&token=${token}`;
    }
    return videoUrl;
  } catch {
    return videoUrl;
  }
}

function buildFullMediaUrl(baseUrl, urlToken) {
  if (!baseUrl) return "";
  if (!urlToken) return baseUrl;
  if (urlToken.startsWith("&") || urlToken.startsWith("?")) {
    return baseUrl + urlToken;
  }
  return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}${urlToken.replace(/^[?&]/, "")}`;
}

/** 腾讯元宝解析分享链接（参考 wx_channels_download/sph.go）；失败返回 null */
async function parseShareViaYuanbao(shareUrl, cookie) {
  const headers = {
    accept: "application/json, text/plain, */*",
    "content-type": "application/json",
    origin: "https://yuanbao.tencent.com",
    referer: "https://yuanbao.tencent.com/",
    "user-agent": DESKTOP_UA,
  };
  if (cookie) headers.cookie = cookie;

  const res = await fetch("https://yuanbao.tencent.com/api/weixin/get_parse_result", {
    method: "POST",
    headers,
    body: JSON.stringify({ type: "video_channel_url", url: shareUrl, scene: 1 }),
    signal: AbortSignal.timeout(20000),
  });

  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      return null;
    }
  }

  if (!res.ok) return null;
  if (data?.error?.code && data.error.code !== "0") return null;
  if (data?.code !== 0 && data?.code !== undefined && data?.code !== 200) return null;

  const payload = data?.data ?? data;
  if (!payload?.wx_export_id && !payload?.playable_url) return null;

  let generalToken = "";
  let exportId = payload.wx_export_id || "";
  if (payload.playable_url) {
    try {
      const u = new URL(payload.playable_url);
      generalToken = u.searchParams.get("token") || generalToken;
      exportId = u.searchParams.get("eid") || exportId;
    } catch {
      /* ignore */
    }
  }

  return {
    exportId,
    generalToken,
    playableUrl: payload.playable_url || "",
    directVideoUrl:
      payload.video_url ||
      payload.videoUrl ||
      payload.mp4_url ||
      (payload.playable_url &&
      /finder\.video\.qq\.com|stodownload|\.mp4/i.test(payload.playable_url)
        ? payload.playable_url
        : ""),
    title: payload.desc || payload.title || "",
    author: payload.author || "",
    cover: payload.cover_url || payload.photo || "",
    thumbnail: payload.cover_url || payload.photo || "",
    source: "yuanbao",
  };
}

function mapDirectUrlToYtDlp(url, meta = {}) {
  const cleaned = cleanVideoUrl(url);
  if (!cleaned) return null;
  return {
    title: meta.title || "微信视频号视频",
    thumbnail: meta.cover || meta.thumbnail || "",
    uploader: meta.author || "",
    webpage_url: meta.shareUrl,
    formats: [
      {
        format_id: "best",
        ext: "mp4",
        url: cleaned,
        height: 0,
        vcodec: "h264",
        acodec: "aac",
        resolution: "best",
      },
    ],
    _encrypted: false,
  };
}

/** channels.weixin.qq.com finder-preview API */
async function fetchFeedInfo(exportId, generalToken) {
  const rid = generateRid();
  const apiUrl = `https://channels.weixin.qq.com/finder-preview/api/feed/get_feed_info?_rid=${rid}&_pageUrl=${encodeURIComponent("https://channels.weixin.qq.com/finder-preview/pages/feed")}`;
  const referer = `https://channels.weixin.qq.com/finder-preview/pages/feed?entry_card_type=48&comment_scene=39&appid=0&token=${encodeURIComponent(generalToken || "")}&entry_scene=0&eid=${encodeURIComponent(exportId || "")}`;

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      Origin: "https://channels.weixin.qq.com",
      Referer: referer,
      "User-Agent": DESKTOP_UA,
    },
    body: JSON.stringify({
      baseReq: { generalToken: generalToken || "" },
      exportId: exportId || "",
    }),
    signal: AbortSignal.timeout(20000),
  });

  const data = await res.json().catch(() => ({}));
  if (data?.errCode !== 0) {
    const msg =
      data?.data?.errMsg?.title ||
      data?.errMsg ||
      "视频号接口返回错误";
    throw new Error(msg);
  }

  const feed = data?.data?.feedInfo;
  if (!feed?.videoUrl && !feed?.h264VideoInfo?.videoUrl) {
    throw new Error("未找到可播放的视频流");
  }

  return data.data;
}

function mapFeedInfoToYtDlp(feedData, meta = {}) {
  const feed = feedData.feedInfo || {};
  const author = feedData.authorInfo || {};
  const title = feed.description || meta.title || "微信视频号视频";
  const thumbnail = feed.coverUrl || meta.cover || meta.thumbnail;

  const candidates = [
    { url: feed.videoUrl, label: "默认", height: 0 },
    { url: feed.h264VideoInfo?.videoUrl, label: "H.264", height: 720 },
    { url: feed.h265VideoInfo?.videoUrl, label: "H.265", height: 720 },
  ].filter((c) => c.url);

  const seen = new Set();
  const formats = [];
  for (const c of candidates) {
    const cleaned = cleanVideoUrl(c.url);
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    formats.push({
      format_id: c.label,
      ext: "mp4",
      url: cleaned,
      height: c.height,
      vcodec: "h264",
      acodec: "aac",
      resolution: c.label,
    });
  }

  return {
    title,
    thumbnail,
    duration: feed.createTime ? undefined : undefined,
    uploader: author.nickname || meta.author || "",
    webpage_url: meta.shareUrl,
    formats,
    _encrypted: false,
  };
}

/** 解析带 decode_key 的 object_desc 结构（第三方/完整 API 响应） */
function mapObjectDescToYtDlp(object, shareUrl) {
  const desc = object?.object_desc || object?.objectDesc || {};
  const mediaList = desc.media || desc.Media || [];
  if (!mediaList.length) {
    throw new Error("未找到视频媒体信息");
  }

  const media = mediaList[0];
  const decodeKey = media.decode_key || media.decodeKey || "";
  const baseUrl = media.url || "";
  const urlToken = media.url_token || media.urlToken || "";
  const fullUrl = buildFullMediaUrl(baseUrl, urlToken);
  const title = desc.description || object?.nickname || "微信视频号视频";
  const thumbnail = media.thumb_url || media.cover_url || media.full_thumb_url || "";

  const formats = [];
  const specs = media.spec || media.Spec || [];
  if (specs.length) {
    const sorted = [...specs].sort((a, b) => (b.height || 0) - (a.height || 0));
    for (const spec of sorted.slice(0, 8)) {
      const flag = spec.file_format || spec.fileFormat;
      let url = fullUrl;
      if (flag) {
        url += `${url.includes("?") ? "&" : "?"}X-snsvideoflag=${flag}`;
      }
      formats.push({
        format_id: flag || "best",
        ext: "mp4",
        url,
        height: spec.height || 0,
        width: spec.width || 0,
        filesize: spec.first_load_bytes || media.file_size,
        vcodec: spec.coding_format || "h264",
        acodec: "aac",
        resolution: spec.height ? `${spec.height}p` : flag || "best",
        _decodeKey: decodeKey,
      });
    }
  }

  if (!formats.length && fullUrl) {
    formats.push({
      format_id: "best",
      ext: "mp4",
      url: fullUrl,
      height: media.height || 0,
      filesize: media.file_size,
      vcodec: "h264",
      acodec: "aac",
      resolution: media.height ? `${Math.round(media.height)}p` : "best",
      _decodeKey: decodeKey,
    });
  }

  return {
    title,
    thumbnail,
    duration: media.video_play_len || media.videoPlayLen,
    uploader: object?.nickname || object?.contact?.nickname || "",
    webpage_url: shareUrl,
    formats,
    _encrypted: Boolean(decodeKey),
    _decodeKey: decodeKey,
  };
}

/** 尝试用 oid + exportKey 访问 web feed 页获取内嵌数据 */
async function fetchWebFeedPage(params) {
  const { shareUrl, oid, nid, exportKey, eid, token } = params;
  const pageUrl = new URL(shareUrl);
  if (oid && !pageUrl.searchParams.has("oid")) pageUrl.searchParams.set("oid", oid);
  if (nid && !pageUrl.searchParams.has("nid")) pageUrl.searchParams.set("nid", nid);
  if (exportKey && !pageUrl.searchParams.has("exportkey")) {
    pageUrl.searchParams.set("exportkey", exportKey);
  }

  const res = await fetch(pageUrl.toString(), {
    redirect: "follow",
    headers: {
      "User-Agent": MOBILE_UA,
      Accept: "text/html,application/json,*/*",
      Referer: "https://channels.weixin.qq.com/",
    },
    signal: AbortSignal.timeout(20000),
  });

  const text = await res.text();

  // JSON 错误响应
  if (text.trim().startsWith("{")) {
    try {
      const json = JSON.parse(text);
      if (json.errCode || json.errMsg) {
        throw new Error(json.errMsg || json.desc || "视频号页面请求被拒绝");
      }
      if (json.data?.object || json.data?.objectDesc) {
        return mapObjectDescToYtDlp(json.data.object || json.data, shareUrl);
      }
    } catch (e) {
      if (e.message.includes("视频号")) throw e;
    }
  }

  // HTML 内嵌 JSON
  const patterns = [
    /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/,
    /"object_desc"\s*:\s*(\{[\s\S]*?"media"\s*:\s*\[[\s\S]*?\]\s*\})/,
    /"feedInfo"\s*:\s*(\{[\s\S]*?"videoUrl"\s*:\s*"[^"]+"[^}]*\})/,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    try {
      const json = JSON.parse(m[1]);
      if (json?.feedInfo) {
        return mapFeedInfoToYtDlp({ feedInfo: json.feedInfo, authorInfo: json.authorInfo }, {
          shareUrl,
        });
      }
      if (json?.object_desc || json?.objectDesc) {
        return mapObjectDescToYtDlp(json, shareUrl);
      }
    } catch {
      /* try next */
    }
  }

  // 已有 eid + token 时直接调 get_feed_info
  const exportId = eid || oid;
  if (exportId) {
    const feedData = await fetchFeedInfo(exportId, token || "");
    return mapFeedInfoToYtDlp(feedData, { shareUrl, title: "", author: "" });
  }

  throw new Error("无法从分享页解析视频，请粘贴完整分享链接（含 exportkey）");
}

function isYuanbaoCookieError(message) {
  return /元宝|yuanbao|Cookie|cookie|登录|未知错误|20000/i.test(message || "");
}

async function attemptExtract(params, cookie) {
  const errors = [];

  const canTryYuanbao =
    Boolean(cookie) ||
    Boolean(params.exportKey) ||
    /exportkey/i.test(params.shareUrl) ||
    /\/sph/i.test(params.shareUrl);

  if (canTryYuanbao) {
    try {
      const parsed = await parseShareViaYuanbao(params.shareUrl, cookie);
      if (!parsed) {
        errors.push("元宝未能解析该分享链接");
      } else {
        const meta = {
          shareUrl: params.shareUrl,
          title: parsed.title,
          author: parsed.author,
          cover: parsed.cover,
          thumbnail: parsed.thumbnail,
        };

        if (parsed.directVideoUrl) {
          const info = mapDirectUrlToYtDlp(parsed.directVideoUrl, meta);
          if (info?.formats.length) {
            return { info, cookieSource: parsed.source, errors };
          }
        }

        if (parsed.exportId) {
          try {
            const feedData = await fetchFeedInfo(parsed.exportId, parsed.generalToken);
            const info = mapFeedInfoToYtDlp(feedData, meta);
            if (info.formats.length) {
              return { info, cookieSource: parsed.source, errors };
            }
          } catch (e) {
            errors.push(e instanceof Error ? e.message : String(e));
          }
        }

        if (parsed.playableUrl) {
          const pageParams =
            parseWeixinChannelsInput(parsed.playableUrl) || {
              ...params,
              shareUrl: parsed.playableUrl,
            };
          try {
            const info = await fetchWebFeedPage(pageParams);
            if (info.formats.length) {
              return { info, cookieSource: `${parsed.source}-playable`, errors };
            }
          } catch (e) {
            errors.push(e instanceof Error ? e.message : String(e));
          }
        }
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  if (params.eid || params.oid) {
    try {
      const feedData = await fetchFeedInfo(params.eid || params.oid, params.token || "");
      const info = mapFeedInfoToYtDlp(feedData, { shareUrl: params.shareUrl });
      if (info.formats.length) {
        return { info, cookieSource: "feed-info", errors };
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  try {
    const info = await fetchWebFeedPage(params);
    if (info.formats.length) {
      return { info, cookieSource: "web-page", errors };
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  return { errors };
}

/**
 * 提取微信视频号视频
 * 策略：元宝 → get_feed_info → 分享页；失败时自动刷新 Cookie 重试
 */
export async function extractWeixinChannels(rawUrl) {
  const params = parseWeixinChannelsInput(rawUrl);
  if (!params?.shareUrl) {
    throw new Error("无法识别微信视频号链接。请粘贴 channels.weixin.qq.com 分享链接");
  }

  const errors = [];

  let cookie = loadYuanbaoCookie();
  let result = await attemptExtract(params, cookie);
  if (result.info) {
    return { info: result.info, cookieSource: result.cookieSource };
  }
  errors.push(...result.errors);

  const shouldRefresh =
    !cookie ||
    result.errors.some((msg) => isYuanbaoCookieError(msg)) ||
    result.errors.length > 0;

  if (shouldRefresh) {
    const refreshed = await refreshYuanbaoCookies();
    if (refreshed) {
      cookie = loadYuanbaoCookie();
      result = await attemptExtract(params, cookie);
      if (result.info) {
        return {
          info: result.info,
          cookieSource: `${result.cookieSource} (refreshed)`,
        };
      }
      errors.push(...result.errors);
    }
  }

  throw new Error(formatWeixinChannelsError(errors[errors.length - 1] || "微信视频号解析失败"));
}

export { cleanVideoUrl, buildFullMediaUrl, mapObjectDescToYtDlp };
