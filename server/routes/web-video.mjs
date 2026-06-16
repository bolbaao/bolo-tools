import { Router } from "express";
import { sendError } from "../lib/http-error.mjs";
import { safeFilename } from "../lib/video-download.mjs";
import { extractVideosFromWebPage } from "../lib/web-page-video-extract.mjs";

const router = Router();

function buildWebPageDownloadPath(mediaUrl, pageUrl, title, ext) {
  const params = new URLSearchParams({
    url: mediaUrl,
    platform: "web-page",
    name: safeFilename(title || "video", ext || "mp4"),
  });
  if (pageUrl) params.set("webpageUrl", pageUrl);
  return `/api/video/download?${params.toString()}`;
}

function buildYtdlpDownloadPath(format, ytdlp, title) {
  const params = new URLSearchParams({
    url: format.url,
    platform: ytdlp.platform || "generic",
    name: safeFilename(title || "video", format.ext || "mp4"),
  });
  if (ytdlp.pageUrl) params.set("webpageUrl", ytdlp.pageUrl);
  if (format.formatId) params.set("formatId", String(format.formatId));
  if (format.decodeKey) params.set("decodeKey", String(format.decodeKey));
  if (format.audioUrl) params.set("audioUrl", format.audioUrl);
  return `/api/video/download?${params.toString()}`;
}

router.post("/extract", async (req, res) => {
  try {
    const data = await extractVideosFromWebPage(req.body?.url);
    const videos = data.videos.map((item) => ({
      ...item,
      downloadUrl:
        item.type === "embed"
          ? null
          : buildWebPageDownloadPath(item.url, data.pageUrl, data.pageTitle, item.type),
    }));

    let ytdlp = null;
    if (data.ytdlp?.formats?.length) {
      ytdlp = {
        platform: data.ytdlp.platform,
        title: data.ytdlp.title,
        pageUrl: data.ytdlp.pageUrl,
        thumbnail: data.ytdlp.thumbnail,
        duration: data.ytdlp.duration,
        formats: data.ytdlp.formats.map((f) => ({
          ...f,
          downloadUrl: buildYtdlpDownloadPath(f, data.ytdlp, data.ytdlp.title),
        })),
      };
    }

    res.json({
      ok: true,
      pageTitle: data.pageTitle,
      pageUrl: data.pageUrl,
      videos,
      ytdlp,
    });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
