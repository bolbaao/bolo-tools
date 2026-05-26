import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_FFMPEG = path.join(__dirname, "..", "..", ".local", "bin", "ffmpeg");

export function getFfmpegPath() {
  try {
    return require("@ffmpeg-installer/ffmpeg").path;
  } catch {
    /* optional package */
  }
  return LOCAL_FFMPEG;
}
