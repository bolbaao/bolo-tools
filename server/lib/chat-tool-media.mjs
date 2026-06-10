import fs from "fs";
import os from "os";
import path from "path";
import { HttpError } from "./http-error.mjs";
import { classifyChatFile } from "./chat-file-types.mjs";
import { convertDocuments } from "./document-convert.mjs";
import { runFfmpeg, runFfprobe } from "./ffmpeg-run.mjs";
import { getFfmpegPath } from "./ffmpeg-bin.mjs";
import { spawn } from "child_process";
import {
  getTranscribeStatus,
  isTranscribeAvailable,
  transcribeAudioFile,
} from "./transcribe.mjs";
import { toSimplifiedChinese } from "./zh-simplify.mjs";
import {
  putChatArtifact,
  formatArtifactLink,
  formatArtifactImage,
} from "./chat-tool-artifacts.mjs";

const FORMAT_MAP = {
  MP3: { ext: "mp3", codec: "libmp3lame" },
  WAV: { ext: "wav", codec: "pcm_s16le" },
  FLAC: { ext: "flac", codec: "flac" },
  AAC: { ext: "aac", codec: "aac" },
  OGG: { ext: "ogg", codec: "libvorbis" },
  M4A: { ext: "m4a", codec: "aac" },
};

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

async function withTmpDir(fn) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pineapple-chat-tool-"));
  try {
    return await fn(tmpDir);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export function pickRawFiles(rawFiles, kind) {
  return (Array.isArray(rawFiles) ? rawFiles : []).filter(
    (f) => f?.buffer?.length && classifyChatFile(f.originalname, f.mimetype) === kind,
  );
}

export function pickFirstRaw(rawFiles, kinds = []) {
  const set = new Set(kinds);
  return (Array.isArray(rawFiles) ? rawFiles : []).find(
    (f) => f?.buffer?.length && set.has(classifyChatFile(f.originalname, f.mimetype)),
  );
}

export function getImageDataUrl(chatFiles, rawFiles) {
  const fromChat = (Array.isArray(chatFiles) ? chatFiles : []).find(
    (f) => f.kind === "image" && f.previewDataUrl,
  );
  if (fromChat?.previewDataUrl) return fromChat.previewDataUrl;

  const img = pickFirstRaw(rawFiles, ["image"]);
  if (!img) return null;
  const mime = img.mimetype || "image/jpeg";
  return `data:${mime};base64,${img.buffer.toString("base64")}`;
}

export async function convertAudioFile(file, format = "MP3") {
  const target = FORMAT_MAP[String(format || "MP3").toUpperCase()];
  if (!target) throw new HttpError(400, "不支持的目标格式");
  if (!file?.buffer?.length) throw new HttpError(400, "请上传音频文件");

  return withTmpDir(async (tmpDir) => {
    const ext = path.extname(file.originalname) || ".mp3";
    const inputPath = path.join(tmpDir, `input${ext}`);
    const outputPath = path.join(tmpDir, `output.${target.ext}`);
    fs.writeFileSync(inputPath, file.buffer);

    const args = ["-y", "-i", inputPath, "-vn"];
    if (target.codec) args.push("-acodec", target.codec);
    args.push(outputPath);
    await runFfmpeg(args);

    const outBuf = fs.readFileSync(outputPath);
    const baseName = path.basename(file.originalname, ext);
    const id = putChatArtifact({
      buffer: outBuf,
      filename: `${baseName}.${target.ext}`,
      contentType: `audio/${target.ext === "mp3" ? "mpeg" : target.ext}`,
    });
    return {
      text: `**音频转换完成**（${target.ext.toUpperCase()}）\n\n${formatArtifactLink(id, `下载 ${baseName}.${target.ext}`)}`,
    };
  });
}

export async function makeGifFromVideo(file, fields) {
  if (!file?.buffer?.length) throw new HttpError(400, "请上传视频文件");

  const start = clamp(Number(fields.start) || 0, 0, 36000);
  const duration = clamp(Number(fields.duration) || 3, 0.5, 30);
  const fps = clamp(Number(fields.fps) || 10, 5, 20);
  const width = clamp(Number(fields.width) || 480, 160, 1280);

  return withTmpDir(async (tmpDir) => {
    const ext = path.extname(file.originalname) || ".mp4";
    const inputPath = path.join(tmpDir, `input${ext}`);
    const outputPath = path.join(tmpDir, "output.gif");
    fs.writeFileSync(inputPath, file.buffer);

    const scaleFilter = `fps=${fps},scale=${width}:-1:flags=lanczos`;
    await runFfmpeg([
      "-y",
      "-ss",
      String(start),
      "-t",
      String(duration),
      "-i",
      inputPath,
      "-vf",
      `${scaleFilter},split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer`,
      "-loop",
      "0",
      outputPath,
    ]);

    const outBuf = fs.readFileSync(outputPath);
    const baseName = path.basename(file.originalname, ext);
    const id = putChatArtifact({
      buffer: outBuf,
      filename: `${baseName}.gif`,
      contentType: "image/gif",
    });
    return {
      text: `**GIF 已生成**（${duration}s · ${width}px · ${fps}fps）\n\n${formatArtifactImage(id, "GIF 动图")}`,
    };
  });
}

export async function runDocConvert(mode, rawFiles) {
  const files = Array.isArray(rawFiles) ? rawFiles.filter((f) => f?.buffer?.length) : [];
  if (!files.length) throw new HttpError(400, "请上传需要转换的文件");

  const { buffer, filename, contentType } = await convertDocuments(mode, files);
  const id = putChatArtifact({ buffer, filename, contentType });
  return {
    text: `**文档转换完成**\n\n${formatArtifactLink(id, `下载 ${filename}`)}`,
  };
}

export async function compressImageFile(file, quality = 80) {
  if (!file?.buffer?.length) throw new HttpError(400, "请上传图片");

  return withTmpDir(async (tmpDir) => {
    const ext = path.extname(file.originalname) || ".jpg";
    const inputPath = path.join(tmpDir, `input${ext}`);
    const outputPath = path.join(tmpDir, "output.jpg");
    fs.writeFileSync(inputPath, file.buffer);

    const q = clamp(Number(quality) || 80, 30, 95);
    await runFfmpeg(["-y", "-i", inputPath, "-q:v", String(Math.round((100 - q) / 3)), outputPath]);

    const outBuf = fs.readFileSync(outputPath);
    const baseName = path.basename(file.originalname, ext);
    const id = putChatArtifact({
      buffer: outBuf,
      filename: `${baseName}-compressed.jpg`,
      contentType: "image/jpeg",
    });
    const before = file.buffer.length;
    const after = outBuf.length;
    return {
      text: `**图片压缩完成**\n\n- 原始：${(before / 1024).toFixed(1)} KB\n- 压缩后：${(after / 1024).toFixed(1)} KB\n\n${formatArtifactImage(id, "压缩结果")}`,
    };
  });
}

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

export async function transcribeMediaFile(file, format = "text") {
  if (!isTranscribeAvailable()) {
    throw new HttpError(503, "语音转写未配置。请配置 ARK_API_KEY 或安装 faster-whisper");
  }
  if (!file?.buffer?.length) throw new HttpError(400, "请上传视频或音频");

  const outFormat = ["srt", "vtt", "text"].includes(format) ? format : "text";

  return withTmpDir(async (tmpDir) => {
    const ext = path.extname(file.originalname) || ".mp4";
    const inputPath = path.join(tmpDir, `input${ext}`);
    const wavPath = path.join(tmpDir, "audio.wav");
    fs.writeFileSync(inputPath, file.buffer);

    await runFfmpeg([
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-acodec",
      "pcm_s16le",
      "-ar",
      "16000",
      "-ac",
      "1",
      wavPath,
    ]);

    const content = await transcribeAudioFile(wavPath, outFormat, "auto");
    const trimmed = toSimplifiedChinese(String(content ?? "").trim());
    if (!trimmed) throw new HttpError(422, "未识别到语音内容");

    const baseName = path.basename(file.originalname, ext);
    const outExt = outFormat === "text" ? "txt" : outFormat;
    const id = putChatArtifact({
      buffer: Buffer.from(trimmed, "utf8"),
      filename: `${baseName}.${outExt}`,
      contentType: "text/plain; charset=utf-8",
    });

    const preview = trimmed.slice(0, 1200);
    return {
      text: `**转写完成**（${getTranscribeStatus().mode || "auto"}）\n\n\`\`\`\n${preview}${trimmed.length > 1200 ? "\n…" : ""}\n\`\`\`\n\n${formatArtifactLink(id, `下载完整字幕`)}`,
    };
  });
}

export async function extractEmbeddedSubtitle(file) {
  if (!file?.buffer?.length) throw new HttpError(400, "请上传视频或字幕文件");

  return withTmpDir(async (tmpDir) => {
    const ext = path.extname(file.originalname) || ".mp4";
    const inputPath = path.join(tmpDir, `input${ext}`);
    const outSrt = path.join(tmpDir, "subs.srt");
    fs.writeFileSync(inputPath, file.buffer);

    await runFfmpeg(["-y", "-i", inputPath, "-map", "0:s:0", "-c:s", "srt", outSrt]);

    if (!fs.existsSync(outSrt)) {
      throw new HttpError(400, "未检测到可提取的字幕轨，请尝试语音转写");
    }

    const content = fs.readFileSync(outSrt, "utf8");
    const baseName = path.basename(file.originalname, ext);
    const id = putChatArtifact({
      buffer: Buffer.from(content, "utf8"),
      filename: `${baseName}.srt`,
      contentType: "text/plain; charset=utf-8",
    });
    const preview = content.slice(0, 1200);
    return {
      text: `**字幕提取完成**\n\n\`\`\`\n${preview}${content.length > 1200 ? "\n…" : ""}\n\`\`\`\n\n${formatArtifactLink(id, "下载 SRT")}`,
    };
  });
}

export function runFfmpegSpawn(args) {
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
    proc.on("error", reject);
  });
}
