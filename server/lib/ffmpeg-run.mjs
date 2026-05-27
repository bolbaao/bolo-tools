import { spawn } from "child_process";
import path from "path";
import { getFfmpegPath } from "./ffmpeg-bin.mjs";

export function getFfprobePath() {
  const ffmpeg = getFfmpegPath();
  const dir = path.dirname(ffmpeg);
  const base = path.basename(ffmpeg).replace(/^ffmpeg/, "ffprobe");
  return path.join(dir, base === ffmpeg ? "ffprobe" : base);
}

export function runFfmpeg(args) {
  return runBin(getFfmpegPath(), args);
}

export function runFfprobe(args) {
  return runBin(getFfprobePath(), args);
}

function runBin(bin, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args);
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr.slice(-800) || `进程退出码 ${code}`));
    });
    proc.on("error", (e) => {
      if (e.code === "ENOENT") {
        reject(new Error("未找到 ffmpeg/ffprobe。请安装 ffmpeg 或重新 npm install"));
      } else reject(e);
    });
  });
}
