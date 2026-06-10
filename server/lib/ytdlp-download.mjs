import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { resolveYtDlpBin, PROJECT_ROOT } from "./ytdlp-runner.mjs";
import {
  buildYtDlpFetchArgs,
  formatYtDlpError,
  getCookieStrategiesForPlatform,
} from "./video-platform.mjs";
import { extractAwemeIdFromUrl } from "./douyin-web.mjs";

function resolveYtDlpFormat(platform, formatId) {
  if (platform === "douyin") return "b";
  if (!formatId || formatId === "default") return "bv*+ba/b";
  return formatId;
}

function resolvePageUrl(pageUrl, platform) {
  if (platform !== "douyin") return pageUrl;
  const id = extractAwemeIdFromUrl(pageUrl);
  if (id) return `https://www.douyin.com/video/${id}`;
  return pageUrl;
}

function isCookieRelatedError(message) {
  return /cookie|Fresh cookies|cookiesfrombrowser|Could not copy/i.test(message || "");
}

function runYtDlpDownloadOnce(pageUrl, platform, strategy, outPath, formatId) {
  return new Promise((resolve, reject) => {
    const bin = resolveYtDlpBin();
    const resolvedUrl = resolvePageUrl(pageUrl, platform);
    const args = [
      ...buildYtDlpFetchArgs(platform, strategy.args),
      "-f",
      resolveYtDlpFormat(platform, formatId),
      "--merge-output-format",
      "mp4",
      "-o",
      outPath,
      resolvedUrl,
    ];
    const proc = spawn(bin, args, {
      env: {
        ...process.env,
        PATH: `${path.join(PROJECT_ROOT, ".local", "bin")}:${process.env.PATH || ""}`,
      },
    });
    let stderr = "";
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(formatYtDlpError(stderr, platform)));
        return;
      }
      if (!fs.existsSync(outPath)) {
        reject(new Error("yt-dlp 未生成输出文件"));
        return;
      }
      resolve(fs.readFileSync(outPath));
    });
    proc.on("error", (e) => {
      if (e.code === "ENOENT") {
        reject(new Error("未安装 yt-dlp。请运行: pip3 install -U yt-dlp"));
      } else reject(e);
    });
  });
}

/**
 * 通过 yt-dlp 从原页 URL 下载（CDN 直链 403 时的回退）
 * @param {string} pageUrl
 * @param {string} platform
 * @param {{ formatId?: string }} opts
 */
export async function downloadWithYtDlp(pageUrl, platform, opts = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pineapple-ytdlp-"));
  const outPath = path.join(tmpDir, "video.mp4");
  const strategies = getCookieStrategiesForPlatform(platform);
  let lastError = null;

  try {
    for (const strategy of strategies) {
      try {
        return await runYtDlpDownloadOnce(pageUrl, platform, strategy, outPath, opts.formatId);
      } catch (e) {
        lastError = e;
        const msg = e instanceof Error ? e.message : String(e);
        if (!isCookieRelatedError(msg)) throw e;
      }
    }
    throw lastError || new Error("yt-dlp 下载失败");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
