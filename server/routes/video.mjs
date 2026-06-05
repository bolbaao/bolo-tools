import { Router } from "express";
import { pipeline } from "stream/promises";
import { HttpError, sendError } from "../lib/http-error.mjs";
import { parseVideoUrl } from "../lib/url-guard.mjs";
import { extractDouyin } from "../lib/douyin-extract.mjs";
import { extractBilibili } from "../lib/bilibili-extract.mjs";
import { extractSocial } from "../lib/social-extract.mjs";
import { extractWeixinChannels } from "../lib/weixin-channels-extract.mjs";
import { decryptWeixinVideo } from "../lib/weixin-channels-decrypt.mjs";
import {
  detectPlatform,
  isSupportedPlatform,
  resolveFinalUrl,
  shouldResolveFinalUrl,
  sortFormatsByQuality,
} from "../lib/video-platform.mjs";
import {
  buildProxyHeaders,
  isAllowedMediaUrl,
  safeFilename,
} from "../lib/video-download.mjs";
import { runYtDlpJson } from "../lib/ytdlp-runner.mjs";

const router = Router();

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

  const formats = list.slice(0, 12).map((f) => ({
    formatId: f.format_id,
    ext: f.ext,
    resolution: formatResolution(f),
    filesize: f.filesize || f.filesize_approx,
    url: f.url,
    decodeKey: f._decodeKey || undefined,
  }));

  if (formats.length) return formats;
  if (info.url) {
    return [{ url: info.url, ext: info.ext || "mp4", resolution: "best" }];
  }
  return [];
}

router.post("/extract", async (req, res) => {
  try {
    const { url } = req.body ?? {};
    if (!url?.trim()) throw new HttpError(400, "请提供视频链接");

    let safeUrl = parseVideoUrl(url);
    let platform = detectPlatform(safeUrl);

    if (!isSupportedPlatform(platform)) {
      throw new HttpError(400, "暂不支持该链接来源");
    }

    if (shouldResolveFinalUrl(safeUrl, platform)) {
      safeUrl = await resolveFinalUrl(safeUrl, platform);
      platform = detectPlatform(safeUrl);
    }

    let info;
    let cookieSource;
    if (platform === "douyin") {
      const result = await extractDouyin(safeUrl);
      info = result.info;
      cookieSource = result.cookieSource;
    } else if (platform === "bilibili") {
      const result = await extractBilibili(safeUrl);
      info = result.info;
      cookieSource = result.cookieSource;
    } else if (platform === "weixin-channels") {
      const result = await extractWeixinChannels(safeUrl);
      info = result.info;
      cookieSource = result.cookieSource;
    } else if (platform === "generic") {
      info = await runYtDlpJson(safeUrl, platform);
    } else {
      const result = await extractSocial(safeUrl, platform);
      info = result.info;
      cookieSource = result.cookieSource;
    }

    const formats = mapFormats(info, platform);
    if (!formats.length) {
      throw new HttpError(502, "未找到可下载的视频流");
    }

    res.json({
      ok: true,
      platform,
      cookieSource,
      title: info.title || "未命名视频",
      thumbnail: info.thumbnail,
      duration: info.duration,
      uploader: info.uploader || info.channel,
      webpageUrl: info.webpage_url || info.webpageUrl || safeUrl,
      formats: formats.map((f) => ({
        ...f,
        downloadUrl: buildDownloadPath(
          f.url,
          platform,
          info.title || "video",
          f.ext,
          f.decodeKey,
        ),
      })),
    });
  } catch (err) {
    sendError(res, err);
  }
});

function buildDownloadPath(mediaUrl, platform, title, ext, decodeKey) {
  const params = new URLSearchParams({
    url: mediaUrl,
    platform: platform || "generic",
    name: safeFilename(title, ext || "mp4"),
  });
  if (decodeKey) params.set("decodeKey", String(decodeKey));
  return `/api/video/download?${params.toString()}`;
}

router.get("/download", async (req, res) => {
  try {
    const rawUrl = String(req.query.url || "");
    const platform = String(req.query.platform || "generic");
    const name = String(req.query.name || "video.mp4");
    const decodeKey = String(req.query.decodeKey || "").trim();

    if (!rawUrl) throw new HttpError(400, "缺少 url 参数");
    const safeUrl = parseVideoUrl(rawUrl);
    if (!isAllowedMediaUrl(safeUrl)) {
      throw new HttpError(403, "不允许代理该地址");
    }

    const headers = buildProxyHeaders(platform, safeUrl);
    const upstream = await fetch(safeUrl, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(300000),
    });

    if (!upstream.ok) {
      throw new HttpError(502, `下载失败 (${upstream.status})`);
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const filename = name.includes(".") ? name : safeFilename(name, "mp4");

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    const len = upstream.headers.get("content-length");
    if (len) res.setHeader("Content-Length", len);

    if (decodeKey && platform === "weixin-channels") {
      const buf = Buffer.from(await upstream.arrayBuffer());
      decryptWeixinVideo(buf, decodeKey);
      if (!res.headersSent) {
        res.setHeader("Content-Length", String(buf.length));
      }
      res.end(buf);
      return;
    }

    if (upstream.body) {
      await pipeline(upstream.body, res);
    } else {
      res.end(Buffer.from(await upstream.arrayBuffer()));
    }
  } catch (err) {
    if (!res.headersSent) sendError(res, err);
    else res.end();
  }
});

export default router;
