import fs from "fs";
import OpenAI, { toFile } from "openai";
import { env } from "./env.mjs";
import { isLocalWhisperAvailable, transcribeWithLocalWhisper } from "./whisper-local.mjs";

export function resolveTranscribeConfig() {
  const apiKey = env("OPENAI_API_KEY") || env("ARK_API_KEY") || env("VOLC_API_KEY");
  if (!apiKey) return null;
  const baseURL =
    env("OPENAI_BASE_URL") ||
    env("TRANSCRIBE_BASE_URL") ||
    (env("ARK_API_KEY") ? env("ARK_BASE_URL") : "") ||
    "https://api.openai.com/v1";
  return {
    apiKey,
    baseURL: baseURL.replace(/\/$/, ""),
    model: env("TRANSCRIBE_MODEL") || env("WHISPER_MODEL") || "whisper-1",
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
        "当前 API 不支持语音转写。请配置 OPENAI_API_KEY 与兼容 Whisper 的 OPENAI_BASE_URL，或安装本地 faster-whisper。",
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
