import fs from "fs";
import os from "os";
import path from "path";
import { runFfmpeg } from "./ffmpeg-run.mjs";
import { buildProxyHeaders } from "./video-download.mjs";

function headerArgs(platform, sourceUrl) {
  const headers = buildProxyHeaders(platform, sourceUrl);
  const lines = Object.entries(headers).map(([k, v]) => `${k}: ${v}`);
  if (!lines.length) return [];
  return ["-headers", `${lines.join("\r\n")}\r\n`];
}

async function fetchToFile(url, platform, destPath) {
  const headers = buildProxyHeaders(platform, url);
  const res = await fetch(url, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(300000),
  });
  if (!res.ok) {
    throw new Error(`下载失败 (${res.status})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
}

function isHlsUrl(url, ext = "") {
  const text = `${url} ${ext}`.toLowerCase();
  return text.includes(".m3u8") || text.includes("application/x-mpegurl");
}

/**
 * 将视频流（可选独立音轨）转为带声音的 MP4
 * @param {{ videoUrl: string, audioUrl?: string, platform?: string, ext?: string }} opts
 * @returns {Promise<Buffer>}
 */
export async function buildVideoWithAudio({ videoUrl, audioUrl, platform = "generic", ext = "" }) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pineapple-vid-"));
  const outPath = path.join(tmpDir, "output.mp4");

  try {
    if (audioUrl) {
      const videoPath = path.join(tmpDir, `video.${isHlsUrl(videoUrl, ext) ? "m3u8" : "bin"}`);
      const audioPath = path.join(tmpDir, `audio.${/m4a|aac/i.test(audioUrl) ? "m4a" : "bin"}`);

      if (isHlsUrl(videoUrl, ext)) {
        await runFfmpeg([
          "-y",
          ...headerArgs(platform, videoUrl),
          "-i",
          videoUrl,
          ...headerArgs(platform, audioUrl),
          "-i",
          audioUrl,
          "-c:v",
          "copy",
          "-c:a",
          "aac",
          "-shortest",
          outPath,
        ]);
      } else {
        await Promise.all([
          fetchToFile(videoUrl, platform, videoPath),
          fetchToFile(audioUrl, platform, audioPath),
        ]);
        await runFfmpeg([
          "-y",
          "-i",
          videoPath,
          "-i",
          audioPath,
          "-c:v",
          "copy",
          "-c:a",
          "aac",
          "-shortest",
          outPath,
        ]);
      }
    } else if (isHlsUrl(videoUrl, ext)) {
      await runFfmpeg([
        "-y",
        ...headerArgs(platform, videoUrl),
        "-i",
        videoUrl,
        "-c",
        "copy",
        "-bsf:a",
        "aac_adtstoasc",
        outPath,
      ]);
    } else {
      return null;
    }

    return fs.readFileSync(outPath);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
