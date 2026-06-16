import { Router } from "express";
import { pipeline } from "stream/promises";
import { HttpError, sendVideoError } from "../lib/http-error.mjs";
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
} from "../lib/video-platform.mjs";
import {
  buildProxyHeaders,
  buildWebPageProxyHeaders,
  isAllowedMediaUrl,
  isAllowedWebPageMediaUrl,
  safeFilename,
} from "../lib/video-download.mjs";
import { mapFormatsWithFallback } from "../lib/video-formats.mjs";
import { buildVideoWithAudio } from "../lib/video-merge.mjs";
import { runYtDlpJson } from "../lib/ytdlp-runner.mjs";
import { downloadWithYtDlp } from "../lib/ytdlp-download.mjs";
import { downloadDouyinWithCookieRefresh } from "../lib/douyin-download.mjs";

const router = Router();

function isHlsUrl(url, ext = "") {
  const text = `${url} ${ext}`.toLowerCase();
  return text.includes(".m3u8");
}

router.post("/extract", async (req, res) => {
  let platform = "generic";
  let safeUrl = "";
  try {
    const { url } = req.body ?? {};
    if (!url?.trim()) throw new HttpError(400, "请提供视频链接");

    safeUrl = parseVideoUrl(url);
    platform = detectPlatform(safeUrl);

    if (!isSupportedPlatform(platform)) {
      throw new HttpError(400, "暂不支持该链接来源");
    }

    if (/mp\.weixin\.qq\.com/i.test(safeUrl)) {
      throw new HttpError(
        400,
        "这是微信公众号文章链接，不是视频号。请在微信中打开视频号，点击「分享」→「复制链接」，粘贴 channels.weixin.qq.com 开头的地址。",
      );
    }

    if (shouldResolveFinalUrl(safeUrl, platform)) {
      safeUrl = await resolveFinalUrl(safeUrl, platform);
      platform = detectPlatform(safeUrl);
    }

    if (platform === "generic" && /weixin|channels\.|finder\.video|exportkey/i.test(safeUrl)) {
      platform = "weixin-channels";
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

    const formats = mapFormatsWithFallback(info, platform);
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
          f.audioUrl,
          info.webpage_url || info.webpageUrl || safeUrl,
          f.formatId,
        ),
      })),
    });
  } catch (err) {
    sendVideoError(res, err, platform, safeUrl || String(req.body?.url || ""));
  }
});

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

function download403Hint(platform) {
  if (platform === "douyin") {
    return "抖音下载失败。请先重新解析后再下载；若仍失败，请在 Safari 登录 douyin.com 后运行 ./scripts/setup-douyin-cookies.sh safari";
  }
  if (platform === "bilibili") {
    return "下载被拒绝（403）。请重新解析后再下载；会员/登录视频需配置 B 站 Cookie";
  }
  if (platform === "weixin-channels") {
    return "下载被拒绝。请重新提取视频；若仍失败，请确认已在浏览器登录腾讯元宝（yuanbao.tencent.com）。";
  }
  return "下载链接已失效或被拒绝（403），请重新解析后再下载";
}

async function sendVideoBuffer(res, buf, filename) {
  res.setHeader("Content-Type", "video/mp4");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(filename.replace(/\.[^.]+$/, ".mp4"))}`,
  );
  res.setHeader("Content-Length", String(buf.length));
  res.end(buf);
}

async function tryYtDlpDownloadFallback({ webpageUrl, platform, formatId, filename, res }) {
  const pageUrl = String(webpageUrl || "").trim();
  if (!pageUrl) return false;
  try {
    parseVideoUrl(pageUrl);
  } catch {
    return false;
  }
  try {
    const buf = await downloadWithYtDlp(pageUrl, platform, { formatId: formatId || undefined });
    await sendVideoBuffer(res, buf, filename);
    return true;
  } catch {
    return false;
  }
}

router.get("/download", async (req, res) => {
  try {
    const rawUrl = String(req.query.url || "");
    const rawAudioUrl = String(req.query.audioUrl || "").trim();
    const platform = String(req.query.platform || "generic");
    const name = String(req.query.name || "video.mp4");
    const decodeKey = String(req.query.decodeKey || "").trim();
    const webpageUrl = String(req.query.webpageUrl || "").trim();
    const formatId = String(req.query.formatId || "").trim();

    if (!rawUrl) throw new HttpError(400, "缺少 url 参数");
    const safeUrl = parseVideoUrl(rawUrl);
    const allowMedia =
      platform === "web-page" ? isAllowedWebPageMediaUrl(safeUrl) : isAllowedMediaUrl(safeUrl);
    if (!allowMedia) {
      throw new HttpError(403, "不允许代理该地址");
    }

    let safeAudioUrl = "";
    if (rawAudioUrl) {
      safeAudioUrl = parseVideoUrl(rawAudioUrl);
      const allowAudio =
        platform === "web-page"
          ? isAllowedWebPageMediaUrl(safeAudioUrl)
          : isAllowedMediaUrl(safeAudioUrl);
      if (!allowAudio) {
        throw new HttpError(403, "不允许代理该音频地址");
      }
    }

    const ext = name.includes(".") ? name.split(".").pop() : "mp4";
    const filename = name.includes(".") ? name : safeFilename(name, "mp4");

    if (platform === "douyin" && webpageUrl) {
      try {
        const buf = await downloadDouyinWithCookieRefresh(webpageUrl);
        await sendVideoBuffer(res, buf, filename);
        return;
      } catch {
        /* fall through to CDN / yt-dlp paths */
      }
    }

    const needsFfmpeg = Boolean(safeAudioUrl) || isHlsUrl(safeUrl, ext);

    if (needsFfmpeg) {
      let merged;
      try {
        merged = await buildVideoWithAudio({
          videoUrl: safeUrl,
          audioUrl: safeAudioUrl || undefined,
          platform,
          ext,
        });
      } catch (mergeErr) {
        const msg = mergeErr instanceof Error ? mergeErr.message : String(mergeErr);
        if (/403|401/.test(msg)) {
          const ok = await tryYtDlpDownloadFallback({
            webpageUrl,
            platform,
            formatId,
            filename,
            res,
          });
          if (ok) return;
        }
        throw mergeErr;
      }
      if (!merged) {
        throw new HttpError(502, "视频合成失败，请换一个清晰度重试");
      }
      let buf = merged;
      if (decodeKey && platform === "weixin-channels") {
        decryptWeixinVideo(buf, decodeKey);
      }
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(filename.replace(/\.[^.]+$/, ".mp4"))}`,
      );
      res.setHeader("Content-Length", String(buf.length));
      res.end(buf);
      return;
    }

    const headers =
      platform === "web-page"
        ? buildWebPageProxyHeaders(webpageUrl, safeUrl)
        : buildProxyHeaders(platform, safeUrl);
    const upstream = await fetch(safeUrl, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(300000),
    });

    if (!upstream.ok) {
      if (upstream.status === 403 || upstream.status === 401) {
        const ok = await tryYtDlpDownloadFallback({
          webpageUrl,
          platform,
          formatId,
          filename,
          res,
        });
        if (ok) return;
        throw new HttpError(502, download403Hint(platform));
      }
      throw new HttpError(502, `下载失败 (${upstream.status})`);
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
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
    if (!res.headersSent) {
      sendVideoError(res, err, String(req.query.platform || "generic"), String(req.query.webpageUrl || req.query.url || ""));
    } else res.end();
  }
});

export default router;
