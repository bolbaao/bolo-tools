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

export function isLocalTranscribeAvailable() {
  return isLocalWhisperAvailable();
}

export function isApiTranscribeAvailable() {
  return Boolean(resolveTranscribeConfig());
}

export function isTranscribeAvailable(preferredMode) {
  if (preferredMode === "local") return isLocalTranscribeAvailable();
  if (preferredMode === "api") return isApiTranscribeAvailable();
  return isLocalTranscribeAvailable() || isApiTranscribeAvailable();
}

/** 默认转写方式：本地优先，否则云端 */
export function getTranscribeMode() {
  if (isLocalTranscribeAvailable()) return "local";
  if (isApiTranscribeAvailable()) return "api";
  return null;
}

export function resolveTranscribeMode(requested) {
  const raw = String(requested || "auto").toLowerCase();
  if (raw === "local" || raw === "api") return raw;
  return getTranscribeMode() || "local";
}

export function getTranscribeStatus() {
  const localAvailable = isLocalTranscribeAvailable();
  const apiAvailable = isApiTranscribeAvailable();
  const defaultMode = getTranscribeMode();
  const localHint = getLocalWhisperHint();
  const apiCfg = resolveTranscribeConfig();

  let hint = null;
  if (!localAvailable && !apiAvailable) {
    hint = localHint || "可在 .env 配置 ARK_API_KEY 使用云端转写";
  } else if (!localAvailable && apiAvailable) {
    hint = "当前仅云端转写可用（已配置 ARK_API_KEY）";
  } else if (localAvailable && !apiAvailable) {
    hint = "可选：在 .env 配置 ARK_API_KEY 后使用云端转写";
  }

  return {
    available: localAvailable || apiAvailable,
    localAvailable,
    apiAvailable,
    mode: defaultMode,
    defaultMode,
    model: getWhisperModel(),
    modelPath: getWhisperModelPath(),
    apiModel: apiCfg?.model ?? null,
    hint,
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
 * @param {"local"|"api"|"auto"} [mode]
 */
export async function transcribeAudioFile(audioPath, format = "srt", mode = "auto") {
  const resolved = resolveTranscribeMode(mode === "auto" ? undefined : mode);
  if (resolved === "local") {
    if (!isLocalTranscribeAvailable()) throw new Error("LOCAL_WHISPER_MISSING");
    return transcribeWithLocalWhisper(audioPath, format);
  }
  if (!isApiTranscribeAvailable()) throw new Error("TRANSCRIBE_KEYS_MISSING");
  return transcribeWithApi(audioPath, format);
}
