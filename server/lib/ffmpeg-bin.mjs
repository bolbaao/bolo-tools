import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_BIN = path.join(__dirname, "..", "..", ".local", "bin");
const LOCAL_FFMPEG = path.join(LOCAL_BIN, "ffmpeg");
const LOCAL_FFPROBE = path.join(LOCAL_BIN, "ffprobe");

export function getFfmpegPath() {
  try {
    return require("@ffmpeg-installer/ffmpeg").path;
  } catch {
    /* optional package */
  }
  return LOCAL_FFMPEG;
}

export function getFfprobePath() {
  try {
    return require("@ffprobe-installer/ffprobe").path;
  } catch {
    /* optional package */
  }
  const ffmpegDir = path.dirname(getFfmpegPath());
  const sibling = path.join(ffmpegDir, "ffprobe");
  if (fs.existsSync(sibling)) return sibling;
  return LOCAL_FFPROBE;
}
