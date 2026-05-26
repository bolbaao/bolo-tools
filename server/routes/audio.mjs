import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import { HttpError, sendError } from "../lib/http-error.mjs";
import { getFfmpegPath } from "../lib/ffmpeg-bin.mjs";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const FORMAT_MAP = {
  MP3: { ext: "mp3", codec: "libmp3lame" },
  WAV: { ext: "wav", codec: "pcm_s16le" },
  FLAC: { ext: "flac", codec: "flac" },
  AAC: { ext: "aac", codec: "aac" },
  OGG: { ext: "ogg", codec: "libvorbis" },
};

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const bin = getFfmpegPath();
    const proc = spawn(bin, args);
    let stderr = "";
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-500) || `ffmpeg 退出码 ${code}`));
    });
    proc.on("error", (e) => {
      if (e.code === "ENOENT") {
        reject(new Error("未找到 ffmpeg。请安装 ffmpeg 或重新 npm install"));
      } else reject(e);
    });
  });
}

router.post("/convert", upload.single("file"), async (req, res) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pineapple-audio-"));
  try {
    if (!req.file) throw new HttpError(400, "请上传音频文件");
    const format = String(req.body.format || "MP3").toUpperCase();
    const target = FORMAT_MAP[format];
    if (!target) throw new HttpError(400, "不支持的目标格式");

    const inputPath = path.join(tmpDir, "input");
    const outputPath = path.join(tmpDir, `output.${target.ext}`);
    fs.writeFileSync(inputPath, req.file.buffer);

    const args = ["-y", "-i", inputPath, "-vn"];
    if (target.codec) args.push("-acodec", target.codec);
    args.push(outputPath);

    await runFfmpeg(args);

    const outBuf = fs.readFileSync(outputPath);
    const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname));
    res.setHeader("Content-Type", `audio/${target.ext === "mp3" ? "mpeg" : target.ext}`);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(baseName)}.${target.ext}"`,
    );
    res.send(outBuf);
  } catch (err) {
    sendError(res, err);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

export default router;
