import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";
import { HttpError, sendError } from "../lib/http-error.mjs";
import { runFfmpeg, runFfprobe } from "../lib/ffmpeg-run.mjs";
import {
  getTranscribeStatus,
  isTranscribeAvailable,
  resolveTranscribeMode,
  transcribeAudioFile,
} from "../lib/transcribe.mjs";
import { toSimplifiedChinese } from "../lib/zh-simplify.mjs";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

const MAX_TRANSCRIBE_SEC = Number(process.env.MAX_TRANSCRIBE_SEC || 600);

async function getMediaDurationSec(filePath) {
  try {
    const { stdout } = await runFfprobe([
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);
    const n = parseFloat(stdout.trim());
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

async function withTmpDir(fn) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pineapple-sub-"));
  try {
    return await fn(tmpDir);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/** 语音转写能力检测（前端展示是否可用） */
router.get("/status", (_req, res) => {
  res.json({ ok: true, ...getTranscribeStatus() });
});

/** 提取内嵌字幕轨 */
router.post("/extract", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) throw new HttpError(400, "请上传视频或字幕文件");

    const result = await withTmpDir(async (tmpDir) => {
      const ext = path.extname(req.file.originalname) || ".mp4";
      const inputPath = path.join(tmpDir, `input${ext}`);
      fs.writeFileSync(inputPath, req.file.buffer);

      const outSrt = path.join(tmpDir, "subs.srt");
      await runFfmpeg([
        "-y",
        "-i",
        inputPath,
        "-map",
        "0:s:0",
        "-c:s",
        "srt",
        outSrt,
      ]);

      if (!fs.existsSync(outSrt)) {
        throw new HttpError(400, "未检测到可提取的字幕轨，请尝试「语音转字幕」");
      }
      return fs.readFileSync(outSrt, "utf8");
    });

    const base = path.basename(req.file.originalname, path.extname(req.file.originalname));
    res.json({ ok: true, format: "srt", content: result, filename: `${base}.srt` });
  } catch (err) {
    if (err instanceof HttpError) sendError(res, err);
    else if (/Stream map|does not contain|Invalid argument/i.test(err.message)) {
      sendError(res, new HttpError(400, "该文件没有内嵌字幕轨"));
    } else sendError(res, err);
  }
});

/** 语音转字幕（本地 faster-whisper 或云端 Whisper 兼容 API） */
router.post("/transcribe", upload.single("file"), async (req, res) => {
  try {
    const transcribeMode = String(req.body.mode || "auto").toLowerCase();
    if (!["auto", "local", "api"].includes(transcribeMode)) {
      throw new HttpError(400, "mode 须为 local / api / auto");
    }
    if (!isTranscribeAvailable(transcribeMode === "auto" ? undefined : transcribeMode)) {
      if (transcribeMode === "api") {
        throw new HttpError(
          503,
          "未配置云端转写。请在 .env 填入 ARK_API_KEY（火山方舟），详见 .env.example。",
        );
      }
      throw new HttpError(
        503,
        "未安装本地转写引擎。请运行: python3 -m pip install --user faster-whisper（或 ./scripts/install-deps.sh）。也可在 .env 配置 ARK_API_KEY 使用云端转写。",
      );
    }
    if (!req.file) throw new HttpError(400, "请上传视频或音频");

    const format = String(req.body.format || "srt").toLowerCase();
    if (!["srt", "vtt", "text"].includes(format)) {
      throw new HttpError(400, "format 须为 srt / vtt / text");
    }

    const payload = await withTmpDir(async (tmpDir) => {
      const ext = path.extname(req.file.originalname) || ".mp4";
      const inputPath = path.join(tmpDir, `input${ext}`);
      const wavPath = path.join(tmpDir, "audio.wav");
      fs.writeFileSync(inputPath, req.file.buffer);

      const duration = await getMediaDurationSec(inputPath);
      const trimArgs =
        duration && duration > MAX_TRANSCRIBE_SEC
          ? ["-t", String(MAX_TRANSCRIBE_SEC)]
          : [];

      await runFfmpeg([
        "-y",
        "-i",
        inputPath,
        ...trimArgs,
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ar",
        "16000",
        "-ac",
        "1",
        wavPath,
      ]);

      const content = await transcribeAudioFile(wavPath, format, transcribeMode);
      const trimmed = String(content ?? "").trim();
      if (!trimmed) {
        throw new HttpError(
          422,
          "未识别到语音内容。请确认文件含清晰人声，或尝试更短的片段与其它格式（mp3/m4a/wav）",
        );
      }
      return {
        content: toSimplifiedChinese(trimmed),
        truncated: Boolean(duration && duration > MAX_TRANSCRIBE_SEC),
        durationSec: duration,
      };
    });

    const base = path.basename(req.file.originalname, path.extname(req.file.originalname));
    const outExt = format === "text" ? "txt" : format;
    const usedMode =
      transcribeMode === "auto" ? resolveTranscribeMode() : transcribeMode;

    res.json({
      ok: true,
      format,
      content: payload.content,
      filename: `${base}.${outExt}`,
      truncated: payload.truncated,
      mode: usedMode,
      message: payload.truncated
        ? `仅转写前 ${MAX_TRANSCRIBE_SEC} 秒，可在 .env 调整 MAX_TRANSCRIBE_SEC`
        : usedMode === "api"
          ? "云端转写完成"
          : undefined,
    });
  } catch (err) {
    if (err.message === "TRANSCRIBE_KEYS_MISSING") {
      sendError(
        res,
        new HttpError(
          503,
          "未配置云端转写。请在 .env 填入 ARK_API_KEY（火山方舟），详见 .env.example。",
        ),
      );
      return;
    }
    if (err.message === "LOCAL_WHISPER_MISSING") {
      sendError(
        res,
        new HttpError(
          503,
          "未安装本地转写引擎。请运行: python3 -m pip install --user faster-whisper",
        ),
      );
      return;
    }
    sendError(res, err);
  }
});

export default router;
