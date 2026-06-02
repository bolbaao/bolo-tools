import { HttpError } from "./http-error.mjs";
import { parseVideoUrl } from "./url-guard.mjs";
import { extractDouyin } from "./douyin-extract.mjs";
import { extractBilibili } from "./bilibili-extract.mjs";
import { extractSocial } from "./social-extract.mjs";
import { extractWeixinChannels } from "./weixin-channels-extract.mjs";
import {
  detectPlatform,
  isSupportedPlatform,
  resolveFinalUrl,
  sortFormatsByQuality,
} from "./video-platform.mjs";
import { safeFilename } from "./video-download.mjs";
import { runYtDlpJson } from "./ytdlp-runner.mjs";

function formatResolution(f) {
  if (f.resolution && f.resolution !== "audio only") return f.resolution;
  if (f.height) return `${f.height}p`;
  if (f.format_note) return f.format_note;
  return f.ext || "默认";
}

function mapFormats(info, platform) {
  let list = (info.formats || []).filter(
    (f) => f.url && (f.vcodec !== "none" || f.acodec !== "none"),
  );

  if (sortFormatsByQuality(platform)) {
    const combined = list.filter((f) => f.vcodec !== "none" && f.acodec !== "none");
    const videoOnly = list.filter((f) => f.vcodec !== "none" && f.acodec === "none");
    list = combined.length ? combined : videoOnly;
    list.sort((a, b) => (b.height || 0) - (a.height || 0));
    const seen = new Set();
    list = list.filter((f) => {
      const key = `${f.height || 0}-${f.ext}-${f.format_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } else {
    list = list.slice(-12);
  }

  return list.slice(0, 8).map((f) => ({
    formatId: f.format_id,
    ext: f.ext,
    resolution: formatResolution(f),
    url: f.url,
    decodeKey: f._decodeKey || undefined,
  }));
}

function buildDownloadPath(mediaUrl, platform, title, ext, decodeKey) {
  const params = new URLSearchParams({
    url: mediaUrl,
    platform: platform || "generic",
    name: safeFilename(title, ext || "mp4"),
  });
  if (decodeKey) params.set("decodeKey", String(decodeKey));
  return `/api/video/download?${params.toString()}`;
}

/** @param {string} url */
export async function extractVideoByUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) throw new HttpError(400, "请提供视频链接");

  let safeUrl = parseVideoUrl(raw);
  let platform = detectPlatform(safeUrl);

  if (!isSupportedPlatform(platform)) {
    throw new HttpError(400, "暂不支持该链接来源");
  }

  if (platform !== "weixin-channels") {
    safeUrl = await resolveFinalUrl(safeUrl, platform);
    platform = detectPlatform(safeUrl);
  }

  let info;
  if (platform === "douyin") {
    info = (await extractDouyin(safeUrl)).info;
  } else if (platform === "bilibili") {
    info = (await extractBilibili(safeUrl)).info;
  } else if (platform === "weixin-channels") {
    info = (await extractWeixinChannels(safeUrl)).info;
  } else if (platform === "generic") {
    info = await runYtDlpJson(safeUrl, platform);
  } else {
    info = (await extractSocial(safeUrl, platform)).info;
  }

  const title = info.title || "未命名视频";
  const formats = mapFormats(info, platform).map((f) => ({
    ...f,
    downloadUrl: buildDownloadPath(f.url, platform, title, f.ext, f.decodeKey),
  }));

  if (!formats.length) throw new HttpError(502, "未找到可下载的视频流");

  return {
    platform,
    title,
    duration: info.duration,
    uploader: info.uploader || info.channel,
    webpageUrl: info.webpage_url || info.webpageUrl || safeUrl,
    formats,
  };
}
