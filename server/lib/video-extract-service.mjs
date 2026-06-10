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
  shouldResolveFinalUrl,
} from "./video-platform.mjs";
import { safeFilename } from "./video-download.mjs";
import { mapFormatsWithFallback } from "./video-formats.mjs";
import {
  buildMediaVerifyBrief,
  mediaVerifyEnabled,
  verifyVideoAgainstBrief,
} from "./media-verify.mjs";
import { formatVideoVerifyFailed } from "../../shared/public-error.mjs";
import { runYtDlpJson } from "./ytdlp-runner.mjs";

function buildDownloadPath(mediaUrl, platform, title, ext, decodeKey, audioUrl, webpageUrl, formatId) {
  const params = new URLSearchParams({
    url: mediaUrl,
    platform: platform || "generic",
    name: safeFilename(title, ext || "mp4"),
  });
  if (decodeKey) params.set("decodeKey", String(decodeKey));
  if (audioUrl) params.set("audioUrl", audioUrl);
  if (webpageUrl) params.set("webpageUrl", webpageUrl);
  if (formatId) params.set("formatId", String(formatId));
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

  if (shouldResolveFinalUrl(safeUrl, platform)) {
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
  const webpageUrl = info.webpage_url || info.webpageUrl || safeUrl;
  const formats = mapFormatsWithFallback(info, platform).map((f) => ({
    ...f,
    downloadUrl: buildDownloadPath(
      f.url,
      platform,
      title,
      f.ext,
      f.decodeKey,
      f.audioUrl,
      webpageUrl,
      f.formatId,
    ),
  }));

  if (!formats.length) throw new HttpError(502, "未找到可下载的视频流");

  return {
    platform,
    title,
    duration: info.duration,
    uploader: info.uploader || info.channel,
    webpageUrl,
    formats,
  };
}

/** @param {string} url @param {{ verify?: boolean, query?: string }} opts */
export async function extractVerifiedVideoByUrl(url, opts = {}) {
  const data = await extractVideoByUrl(url);
  if (opts.verify === false || !mediaVerifyEnabled()) {
    return { ...data, verified: false };
  }

  const query = String(opts.query || data.title || url).trim();
  const brief = await buildMediaVerifyBrief(query, "video");
  const check = await verifyVideoAgainstBrief(
    {
      title: data.title,
      uploader: data.uploader,
      duration: data.duration,
      webpageUrl: data.webpageUrl,
      platform: data.platform,
    },
    brief,
    query,
  );

  if (!check.match) {
    throw new HttpError(422, formatVideoVerifyFailed(query));
  }

  return {
    ...data,
    verified: true,
    verifyReason: check.reason,
  };
}
