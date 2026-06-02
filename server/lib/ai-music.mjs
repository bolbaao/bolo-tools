import axios from "axios";
import { HttpError } from "./http-error.mjs";
import { env } from "./env.mjs";
import { demoMusicAvailable, generateDemoMusic } from "./ai-music-demo.mjs";
import { listSunoPresets, resolveSunoConfig } from "./suno-config.mjs";

const DEFAULT_MODEL = "chirp-v4";
const DEFAULT_TIMEOUT_MS = 300000;
const POLL_INTERVAL_MS = 5000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function aiMusicConfigured() {
  return resolveSunoConfig().configured;
}

export function aiMusicCapabilities() {
  const suno = aiMusicConfigured();
  const demo = demoMusicAvailable();
  const cfg = resolveSunoConfig();
  return {
    configured: suno || demo,
    suno,
    demo,
    mode: suno ? "suno" : demo ? "demo" : "none",
    provider: cfg.providerLabel || cfg.providerId || null,
    presets: listSunoPresets(),
  };
}

function sunoClient() {
  const cfg = resolveSunoConfig();
  return axios.create({
    baseURL: cfg.baseURL,
    timeout: 90000,
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    validateStatus: (s) => s < 500,
  });
}

function extractClips(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;

  // OpenAI-HK / 浮云：{ code, data: { data: [clips] } }
  if (Array.isArray(data?.data?.data)) return data.data.data;
  if (data?.data?.data && typeof data.data.data === "object" && data.data.data.audio_url) {
    return [data.data.data];
  }

  if (Array.isArray(data.clips)) return data.clips;
  if (Array.isArray(data.data?.clips)) return data.data.clips;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.songs)) return data.songs;
  return [];
}

function clipHasAudio(clip) {
  return Boolean(clip?.audio_url?.trim());
}

function clipFailed(clip) {
  const status = String(clip?.status || "").toLowerCase();
  if (status === "error" || status === "failed") return true;
  return Boolean(clip?.metadata?.error_message || clip?.error_message);
}

function formatTrack(clip) {
  return {
    id: clip.id || "",
    title: clip.title || clip.metadata?.title || "未命名曲目",
    audioUrl: clip.audio_url || "",
    imageUrl: clip.image_url || clip.image_large_url || "",
    tags: clip.metadata?.tags || "",
    duration: clip.metadata?.duration ?? null,
    status: clip.status || "complete",
  };
}

function formatTracks(clips) {
  return clips.filter(clipHasAudio).map(formatTrack);
}

async function pollClipFeed(client, clipIds, timeoutMs) {
  const ids = clipIds.filter(Boolean);
  if (!ids.length) throw new HttpError(502, "音乐服务未返回有效任务 ID");

  const feedPaths = [
    `/suno/v2/feed?ids=${ids.join(",")}`,
    `/suno/feed?ids=${ids.join(",")}`,
  ];
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    for (const path of feedPaths) {
      try {
        const { data, status } = await client.get(path);
        if (status >= 400) continue;

        const clips = extractClips(data);
        if (!clips.length) continue;

        const ready = clips.filter(clipHasAudio);
        if (ready.length) return ready;

        if (clips.every(clipFailed)) {
          const msg =
            clips[0]?.metadata?.error_message ||
            clips[0]?.error_message ||
            "音乐生成失败";
          throw new HttpError(502, msg);
        }
      } catch (err) {
        if (err instanceof HttpError) throw err;
      }
    }
    await sleep(POLL_INTERVAL_MS);
  }

  throw new HttpError(408, "音乐生成超时，请稍后再试");
}

async function pollTaskResult(client, taskId, timeoutMs) {
  const fetchPaths = [
    `/suno/fetch/${taskId}`,
    `/suno/query/${taskId}`,
    `/suno/task/${taskId}`,
  ];
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    for (const path of fetchPaths) {
      try {
        const { data, status } = await client.get(path);
        if (status >= 400) continue;

        const clips = extractClips(data);
        const ready = clips.filter(clipHasAudio);
        if (ready.length) return ready;

        const task = data?.data && typeof data.data === "object" ? data.data : data;
        const taskStatus = String(task?.status || "").toUpperCase();
        if (taskStatus === "FAILED" || taskStatus === "FAILURE" || taskStatus === "ERROR") {
          throw new HttpError(502, task?.fail_reason || task?.message || data?.message || "音乐生成任务失败");
        }
        if (data?.code && data.code !== "success" && data.code !== "SUCCESS") {
          throw new HttpError(502, data.message || "音乐任务查询失败");
        }
      } catch (err) {
        if (err instanceof HttpError) throw err;
      }
    }
    await sleep(POLL_INTERVAL_MS);
  }

  throw new HttpError(408, "音乐生成超时，请稍后再试");
}

async function submitViaV2(client, body, timeoutMs) {
  const { data, status } = await client.post("/suno/v2/generate", body);
  if (status >= 400) {
    const msg =
      data?.error?.message ||
      data?.error ||
      data?.message ||
      (typeof data?.detail === "string" ? data.detail : null) ||
      `Suno API 错误 (${status})`;
    throw new HttpError(status === 401 ? 401 : 502, msg);
  }

  let clips = extractClips(data);
  const clipIds = clips.map((c) => c.id).filter(Boolean);

  if (!clipIds.length && data?.id) {
    clips = await pollClipFeed(client, [data.id], timeoutMs);
  } else if (clipIds.length && clips.some((c) => !clipHasAudio(c))) {
    clips = await pollClipFeed(client, clipIds, timeoutMs);
  }

  const tracks = formatTracks(clips);
  if (!tracks.length) {
    throw new HttpError(502, "音乐已提交但未返回可播放音频，请检查 Suno 网关配置与余额");
  }
  return tracks;
}

async function submitViaTask(client, body, timeoutMs) {
  const { data, status } = await client.post("/suno/submit/music", body);
  if (status >= 400) {
    const msg = data?.error || data?.message || `Suno API 错误 (${status})`;
    throw new HttpError(status === 401 ? 401 : 502, msg);
  }

  if (data?.code && data.code !== "success") {
    throw new HttpError(502, data.message || "音乐任务提交失败");
  }

  const taskId = data?.data || data?.task_id || data?.id;
  if (!taskId) {
    const direct = formatTracks(extractClips(data));
    if (direct.length) return direct;
    throw new HttpError(502, "音乐服务未返回任务 ID");
  }

  const clips = await pollTaskResult(client, taskId, timeoutMs);
  const tracks = formatTracks(clips);
  if (!tracks.length) throw new HttpError(502, "音乐生成完成但未返回音频");
  return tracks;
}

function buildRequestBody({ prompt, style, title, instrumental, mode }) {
  const cfg = resolveSunoConfig();
  const mv = cfg.model || DEFAULT_MODEL;
  const trimmed = prompt.trim();

  if (mode === "lyrics") {
    return {
      prompt: trimmed,
      tags: style?.trim() || "pop, chinese",
      title: title?.trim() || trimmed.slice(0, 24) || "我的歌曲",
      mv,
    };
  }

  return {
    gpt_description_prompt: trimmed,
    make_instrumental: Boolean(instrumental),
    mv,
    ...(style?.trim() ? { tags: style.trim() } : {}),
  };
}

/**
 * @param {{ prompt: string, style?: string, title?: string, instrumental?: boolean, mode?: "inspiration" | "lyrics" }} opts
 */
export async function generateAiMusic(opts) {
  if (!aiMusicConfigured()) {
    if (demoMusicAvailable()) {
      return generateDemoMusic(opts);
    }
    throw new HttpError(
      503,
      "未配置 SUNO_API_KEY / SUNO_API_BASE，且无可用 AI Key 作为演示回退。请在 .env 配置后重启。",
    );
  }

  const { prompt, style, title, instrumental = false, mode = "inspiration" } = opts;
  if (!prompt?.trim()) throw new HttpError(400, "请填写创作描述或歌词");

  const client = sunoClient();
  const body = buildRequestBody({ prompt, style, title, instrumental, mode });
  const timeoutMs = Number(env("SUNO_TIMEOUT_MS", String(DEFAULT_TIMEOUT_MS))) || DEFAULT_TIMEOUT_MS;
  const apiMode = resolveSunoConfig().apiMode.toLowerCase();

  if (apiMode === "submit") {
    return submitViaTask(client, body, timeoutMs);
  }
  if (apiMode === "v2") {
    return submitViaV2(client, body, timeoutMs);
  }

  try {
    return await submitViaV2(client, body, timeoutMs);
  } catch (v2Err) {
    if (v2Err instanceof HttpError && (v2Err.status === 401 || v2Err.status === 404)) {
      throw v2Err;
    }
    try {
      return await submitViaTask(client, body, timeoutMs);
    } catch (taskErr) {
      throw taskErr instanceof HttpError ? taskErr : v2Err;
    }
  }
}
