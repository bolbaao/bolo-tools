import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildYtDlpBaseArgs, formatYtDlpError } from "./video-platform.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.join(__dirname, "..", "..");

export function resolveYtDlpBin() {
  const local = path.join(PROJECT_ROOT, ".local", "bin", "yt-dlp");
  if (process.env.YTDLP_BIN) return process.env.YTDLP_BIN;
  return fs.existsSync(local) ? local : "yt-dlp";
}

export function runYtDlpJson(url, platform, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const bin = resolveYtDlpBin();
    const args = [...buildYtDlpBaseArgs(platform), ...extraArgs, url];
    const proc = spawn(bin, args, {
      env: {
        ...process.env,
        PATH: `${path.join(PROJECT_ROOT, ".local", "bin")}:${process.env.PATH || ""}`,
      },
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(formatYtDlpError(stderr, platform)));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error("解析视频信息失败"));
      }
    });
    proc.on("error", (e) => {
      if (e.code === "ENOENT") {
        reject(new Error("未安装 yt-dlp。请运行: pip3 install -U yt-dlp"));
      } else reject(e);
    });
  });
}
