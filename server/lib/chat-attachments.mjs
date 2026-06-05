import fs from "fs";
import os from "os";
import path from "path";
import { HttpError } from "./http-error.mjs";
import {
  classifyChatFile,
  maxBytesForKind,
} from "./chat-file-types.mjs";
import { extractDocumentText } from "./chat-document-extract.mjs";
import { runFfmpeg, runFfprobe } from "./ffmpeg-run.mjs";
import {
  describePhotoDataUrl,
  photoVisionConfigured,
  resolveChatImagesSnapshot,
  chatImageVisionPayload,
  formatChatImagesForPrompt,
} from "./photo-vision.mjs";
import { getTranscribeStatus, isTranscribeAvailable, transcribeAudioFile } from "./transcribe.mjs";
import { IMAGE_VISION_UNAVAILABLE } from "../../shared/public-error.mjs";

const MAX_TRANSCRIBE_SEC = Number(process.env.MAX_CHAT_TRANSCRIBE_SEC || 300);

async function withTmpDir(fn) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pineapple-chat-"));
  try {
    return await fn(tmpDir);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function probeMedia(filePath) {
  try {
    const { stdout } = await runFfprobe([
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=codec_type,codec_name,width,height",
      "-of",
      "json",
      filePath,
    ]);
    const data = JSON.parse(stdout);
    const duration = Number(data?.format?.duration);
    const streams = data?.streams || [];
    const video = streams.find((s) => s.codec_type === "video");
    const audio = streams.find((s) => s.codec_type === "audio");
    const parts = [];
    if (Number.isFinite(duration)) parts.push(`时长 ${Math.round(duration)} 秒`);
    if (video?.width && video?.height) parts.push(`画面 ${video.width}×${video.height}`);
    if (video?.codec_name) parts.push(`视频编码 ${video.codec_name}`);
    if (audio?.codec_name) parts.push(`音频编码 ${audio.codec_name}`);
    return {
      durationSec: Number.isFinite(duration) ? duration : null,
      hasAudio: Boolean(audio),
      summary: parts.join(" · "),
    };
  } catch {
    return { durationSec: null, hasAudio: false, summary: "" };
  }
}

async function extractAudioToWav(inputPath, outputPath) {
  await runFfmpeg(["-y", "-i", inputPath, "-vn", "-ac", "1", "-ar", "16000", outputPath]);
}

async function transcribeMediaFile(filePath, originalName) {
  if (!isTranscribeAvailable()) {
    return { transcript: null, error: "语音转写未配置，可在 .env 配置 ARK_API_KEY 或安装 faster-whisper" };
  }

  return withTmpDir(async (tmpDir) => {
    const ext = path.extname(originalName) || path.extname(filePath) || ".mp4";
    const inputPath = path.join(tmpDir, `input${ext}`);
    fs.copyFileSync(filePath, inputPath);

    const probe = await probeMedia(inputPath);
    if (probe.durationSec != null && probe.durationSec > MAX_TRANSCRIBE_SEC) {
      return {
        transcript: null,
        error: `媒体超过 ${MAX_TRANSCRIBE_SEC} 秒，请裁剪后重试`,
        metadata: probe.summary,
      };
    }
    if (!probe.hasAudio) {
      return {
        transcript: null,
        error: "该视频无音轨，无法转写语音；可根据下方媒体信息回答",
        metadata: probe.summary,
      };
    }

    try {
      const wavPath = path.join(tmpDir, "audio.wav");
      await extractAudioToWav(inputPath, wavPath);
      const transcript = await transcribeAudioFile(wavPath, "text", "auto");
      return {
        transcript: String(transcript || "").trim().slice(0, 12000),
        metadata: probe.summary,
      };
    } catch (e) {
      const msg = e?.message || String(e);
      return {
        transcript: null,
        error: /does not contain any stream|does not contain an audio stream/i.test(msg)
          ? "该视频无音轨，无法转写语音；可根据下方媒体信息回答"
          : `语音转写失败：${msg.slice(-200)}`,
        metadata: probe.summary,
      };
    }
  });
}

async function processImage(buffer, name, mimeType) {
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${mimeType || "image/jpeg"};base64,${base64}`;
  if (!photoVisionConfigured()) {
    return {
      kind: "image",
      name,
      mimeType,
      previewDataUrl: dataUrl,
      error: IMAGE_VISION_UNAVAILABLE,
    };
  }
  try {
    const result = await describePhotoDataUrl(dataUrl, "请描述这张图片的内容，便于后续对话引用");
    return {
      kind: "image",
      name,
      mimeType,
      previewDataUrl: dataUrl,
      description: result?.description || null,
      visionProvider: result?.providerLabel || null,
    };
  } catch (e) {
    return {
      kind: "image",
      name,
      mimeType,
      previewDataUrl: dataUrl,
      error: e.message || "图像识别失败",
    };
  }
}

async function processDocument(buffer, name) {
  const { content, kind } = await extractDocumentText(buffer, name);
  return { kind: "document", name, docKind: kind, content: content.slice(0, 12000) };
}

async function processText(buffer, name) {
  const content = buffer.toString("utf8").trim();
  if (!content) throw new HttpError(422, "文本文件为空");
  return { kind: "text", name, content: content.slice(0, 12000) };
}

async function processAudio(buffer, name) {
  return withTmpDir(async (tmpDir) => {
    const ext = path.extname(name) || ".mp3";
    const filePath = path.join(tmpDir, `audio${ext}`);
    fs.writeFileSync(filePath, buffer);
    const probe = await probeMedia(filePath);
    const { transcript, error, metadata } = await transcribeMediaFile(filePath, name);
    return {
      kind: "audio",
      name,
      metadata: metadata || probe.summary,
      transcript,
      error,
    };
  });
}

async function processVideo(buffer, name) {
  return withTmpDir(async (tmpDir) => {
    const ext = path.extname(name) || ".mp4";
    const filePath = path.join(tmpDir, `video${ext}`);
    fs.writeFileSync(filePath, buffer);
    const probe = await probeMedia(filePath);
    let transcript = null;
    let error = null;
    let metadata = probe.summary;
    try {
      const result = await transcribeMediaFile(filePath, name);
      transcript = result.transcript;
      error = result.error;
      metadata = result.metadata || probe.summary;
    } catch (e) {
      error = e?.message || "视频处理失败";
    }
    return {
      kind: "video",
      name,
      metadata,
      transcript,
      error,
    };
  });
}

/**
 * @param {{ originalname: string, mimetype: string, buffer: Buffer, size: number }[]} files
 */
export async function processChatUploadFiles(files) {
  const results = [];
  for (const file of files) {
    const name = String(file.originalname || "file").slice(0, 200);
    const mimeType = String(file.mimetype || "application/octet-stream");
    let kind = classifyChatFile(name, mimeType);
    if (kind === "unknown" && file.buffer?.length >= 4) {
      const head = file.buffer.slice(0, 4).toString();
      if (head === "%PDF") kind = "document";
    }
    const limit = maxBytesForKind(kind);

    if (file.size > limit) {
      results.push({
        kind,
        name,
        mimeType,
        error: `文件过大（上限 ${Math.round(limit / 1024 / 1024)}MB）`,
      });
      continue;
    }

    try {
      if (kind === "image") {
        results.push(await processImage(file.buffer, name, mimeType));
      } else if (kind === "document") {
        results.push(await processDocument(file.buffer, name));
      } else if (kind === "text") {
        results.push(await processText(file.buffer, name));
      } else if (kind === "audio") {
        results.push(await processAudio(file.buffer, name));
      } else if (kind === "video") {
        results.push(await processVideo(file.buffer, name));
      } else {
        results.push({ kind: "unknown", name, mimeType, error: "暂不支持此文件类型" });
      }
    } catch (e) {
      results.push({
        kind,
        name,
        mimeType,
        error: e instanceof HttpError ? e.message : e.message || "处理失败",
      });
    }
  }
  return results;
}

export function formatChatFilesForPrompt(files) {
  if (!Array.isArray(files) || !files.length) return "";

  const lines = ["\n【用户附件识别结果（请据实引用，勿说看不到）】"];
  for (const file of files) {
    lines.push(`\n📎 ${file.name}（${file.kind}${file.docKind ? `/${file.docKind}` : ""}）`);
    if (file.description) lines.push(`图像识别：${file.description}`);
    if (file.metadata) lines.push(`媒体信息：${file.metadata}`);
    if (file.transcript) lines.push(`语音/视频转写：\n${file.transcript}`);
    if (file.content) lines.push(`文档/文本内容：\n${file.content}`);
    if (file.error) lines.push(`说明：${file.error}`);
  }
  return lines.join("\n");
}

function normalizePageChatImages(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((i) => i && typeof i.name === "string")
    .map((i) => ({
      name: i.name,
      size: i.size ?? 0,
      lastModified: i.lastModified ?? 0,
      mimeType: i.mimeType || "image/jpeg",
      width: i.width,
      height: i.height,
      previewDataUrl: i.previewDataUrl,
      visionDescription: i.visionDescription,
      visionProvider: i.visionProvider,
      visionError: i.visionError,
    }));
}

export async function buildAttachmentContext(chatFiles, lastUserMessage, pageContextChatImages) {
  const files = Array.isArray(chatFiles) ? chatFiles : [];
  const fileBlock = formatChatFilesForPrompt(files);

  const fromFiles = files
    .filter((f) => f.kind === "image" && (f.previewDataUrl || f.description || f.error))
    .map((f, i) => ({
      name: f.name,
      size: 0,
      lastModified: Date.now() + i,
      mimeType: f.mimeType || "image/jpeg",
      previewDataUrl: f.previewDataUrl,
      visionDescription: f.description,
      visionProvider: f.visionProvider,
      visionError: f.error,
    }));

  const fromPage = normalizePageChatImages(pageContextChatImages);
  const seen = new Set();
  const chatImages = [...fromPage, ...fromFiles].filter((img) => {
    const key = `${img.name}:${img.lastModified}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let chatImageVision = [];
  let imageBlock = "";
  if (chatImages.length) {
    const snap = await resolveChatImagesSnapshot(chatImages, { userContext: lastUserMessage });
    chatImageVision = chatImageVisionPayload(snap);
    imageBlock = formatChatImagesForPrompt(snap);
  }

  return { fileBlock, imageBlock, chatImageVision };
}

export function getChatAttachmentCapabilities() {
  const transcribe = getTranscribeStatus();
  return {
    image: photoVisionConfigured(),
    document: true,
    text: true,
    audio: transcribe.available,
    video: transcribe.available,
    transcribe,
  };
}
