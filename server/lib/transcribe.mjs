import fs from "fs";
import OpenAI, { toFile } from "openai";
import { env } from "./env.mjs";
import {
  getLocalWhisperHint,
  getWhisperModel,
  getWhisperModelPath,
  isLocalWhisperAvailable,
  transcribeWithLocalWhisper,
} from "./whisper-local.mjs";

const ARK_DEFAULT_BASE = "https://ark.cn-beijing.volces.com/api/v3";

export function resolveTranscribeConfig() {
  const apiKey = env("ARK_API_KEY") || env("VOLC_API_KEY");
  if (!apiKey) return null;
  const baseURL = (env("TRANSCRIBE_BASE_URL") || env("ARK_BASE_URL") || ARK_DEFAULT_BASE).replace(
    /\/$/,
    "",
  );
  return {
    apiKey,
    baseURL,
    model: env("TRANSCRIBE_MODEL") || "whisper-1",
  };
}

export function isTranscribeAvailable() {
  return isLocalWhisperAvailable() || Boolean(resolveTranscribeConfig());
}

export function getTranscribeMode() {
  if (isLocalWhisperAvailable()) return "local";
  if (resolveTranscribeConfig()) return "api";
  return null;
}

export function getTranscribeStatus() {
  const mode = getTranscribeMode();
  const localHint = getLocalWhisperHint();
  return {
    available: Boolean(mode),
    mode,
    model: getWhisperModel(),
    modelPath: getWhisperModelPath(),
    hint: mode ? null : localHint || "可在 .env 配置 ARK_API_KEY 使用云端转写",
  };
}

async function transcribeWithApi(audioPath, format = "srt") {
  const cfg = resolveTranscribeConfig();
  if (!cfg) {
    throw new Error("TRANSCRIBE_KEYS_MISSING");
  }

  const client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL });
  const buffer = fs.readFileSync(audioPath);
  const name = audioPath.endsWith(".mp3") ? "audio.mp3" : "audio.wav";
  const file = await toFile(buffer, name);

  const responseFormat = format === "text" ? "text" : format;

  try {
    const result = await client.audio.transcriptions.create({
      file,
      model: cfg.model,
      response_format: responseFormat,
      language: env("TRANSCRIBE_LANGUAGE") || undefined,
    });
    if (typeof result === "string") return result;
    return result.text || String(result);
  } catch (err) {
    const msg = err?.message || String(err);
    if (/not found|404|unsupported|Invalid/i.test(msg)) {
      throw new Error(
        "当前 API 不支持语音转写。请配置 ARK_API_KEY，或安装本地 faster-whisper。",
      );
    }
    throw err;
  }
}

/**
 * @param {string} audioPath - wav/mp3 等
 * @param {"srt"|"vtt"|"text"} format
 */
export async function transcribeAudioFile(audioPath, format = "srt") {
  if (isLocalWhisperAvailable()) {
    return transcribeWithLocalWhisper(audioPath, format);
  }
  return transcribeWithApi(audioPath, format);
}
