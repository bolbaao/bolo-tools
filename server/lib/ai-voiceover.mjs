import fs from "fs";
import OpenAI from "openai";
import path from "path";
import { HttpError } from "./http-error.mjs";
import { getChatProviderLabel, resolveChatConfig } from "./chat-config.mjs";
import { env } from "./env.mjs";
import {
  DEFAULT_TTS_VOICES,
  getDefaultTtsVoice,
  getEdgeTtsHint,
  isEdgeTtsAvailable,
  synthesizeSpeech,
} from "./edge-tts.mjs";
import { MAX_VIDEO_EDIT_SEC, probeVideo } from "./ai-video-edit.mjs";
import { runFfmpeg, runFfprobe } from "./ffmpeg-run.mjs";

export const MAX_VOICEOVER_SEGMENTS = Number(env("MAX_VOICEOVER_SEGMENTS", "40")) || 40;
export const MAX_SCRIPT_CHARS = Number(env("MAX_VOICEOVER_SCRIPT_CHARS", "8000")) || 8000;

const VOICEOVER_SYSTEM_PROMPT = `你是口播视频剪辑导演。根据用户文稿与素材库信息，为每句/每段口播匹配最合适的视频片段，并输出 JSON（不要 markdown）。

素材库：多个视频片段，clipIndex 从 0 开始，对应上传顺序。

输出格式：
{
  "summary": "一句话说明剪辑思路",
  "voice": "zh-CN-XiaoxiaoNeural",
  "aspect": "9:16",
  "segments": [
    {
      "text": "该段口播原文（完整一句或短段）",
      "clipIndex": 0,
      "clipStart": 0.0,
      "clipEnd": 5.2,
      "matchReason": "为何选这段素材"
    }
  ]
}

规则：
- 将文稿按自然语义拆成 segments，每段 text 15–80 字为宜，总数不超过 ${MAX_VOICEOVER_SEGMENTS}
- clipIndex 必须在素材范围内；clipStart/clipEnd 不得超过该素材时长，且 clipEnd > clipStart + 0.3
- 尽量让画面内容与口播语义相关（根据素材文件名与时长合理推断）
- 同一片材可多次使用不同时间段
- 覆盖完整文稿，顺序与文稿一致
- aspect 可选 16:9、9:16、1:1，竖屏口播优先 9:16
- voice 从下列选一：${DEFAULT_TTS_VOICES.map((v) => v.id).join("、")}
- 不要输出 segments 以外的字段`;

/**
 * @param {string[]} inputPaths
 * @param {{ originalname?: string }[]} [fileInfos]
 */
export async function probeClipLibrary(inputPaths, fileInfos = []) {
  const clips = [];
  for (let i = 0; i < inputPaths.length; i++) {
    const meta = await probeVideo(inputPaths[i]);
    clips.push({
      index: i,
      name: fileInfos[i]?.originalname || path.basename(inputPaths[i]),
      path: inputPaths[i],
      ...meta,
    });
  }
  return clips;
}

export function normalizeScript(raw) {
  const text = String(raw ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!text) throw new HttpError(400, "请粘贴或上传口播文稿");
  if (text.length > MAX_SCRIPT_CHARS) {
    throw new HttpError(400, `文稿超过 ${MAX_SCRIPT_CHARS} 字上限`);
  }
  return text;
}

function parseAiJson(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw new HttpError(502, "AI 返回的口播方案无法解析");
  }
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/**
 * @param {object} raw
 * @param {{ index: number, duration: number, name: string }[]} clips
 */
export function normalizeVoiceoverPlan(raw, clips) {
  if (!raw || typeof raw !== "object") throw new HttpError(400, "口播方案无效");
  const segmentsIn = Array.isArray(raw.segments) ? raw.segments : [];
  if (!segmentsIn.length) throw new HttpError(400, "口播方案为空");
  if (segmentsIn.length > MAX_VOICEOVER_SEGMENTS) {
    throw new HttpError(400, `口播分段超过 ${MAX_VOICEOVER_SEGMENTS} 段上限`);
  }

  const voiceIds = new Set(DEFAULT_TTS_VOICES.map((v) => v.id));
  const voice = voiceIds.has(raw.voice) ? raw.voice : getDefaultTtsVoice();
  const aspect = ["16:9", "9:16", "1:1", "4:3"].includes(raw.aspect) ? raw.aspect : "9:16";

  const segments = [];
  let totalEst = 0;

  for (let i = 0; i < segmentsIn.length; i++) {
    const item = segmentsIn[i];
    const text = String(item?.text ?? "").trim();
    if (!text) throw new HttpError(400, `口播方案第 ${i + 1} 段缺少文案`);

    let clipIndex = Number(item.clipIndex);
    if (!Number.isInteger(clipIndex)) clipIndex = Number(item.clip ?? item.material ?? 0);
    if (clipIndex < 0 || clipIndex >= clips.length) {
      throw new HttpError(400, `第 ${i + 1} 段素材索引无效（clipIndex=${item.clipIndex}）`);
    }

    const clip = clips[clipIndex];
    let clipStart = clamp(Number(item.clipStart) || 0, 0, clip.duration - 0.3);
    let clipEnd = item.clipEnd != null ? Number(item.clipEnd) : clip.duration;
    if (!Number.isFinite(clipEnd)) clipEnd = clip.duration;
    clipEnd = clamp(clipEnd, clipStart + 0.3, clip.duration);

    totalEst += clipEnd - clipStart;
    segments.push({
      text,
      clipIndex,
      clipStart,
      clipEnd,
      clipName: clip.name,
      matchReason:
        typeof item.matchReason === "string" ? item.matchReason.slice(0, 120) : undefined,
    });
  }

  if (totalEst > MAX_VIDEO_EDIT_SEC * 2) {
    throw new HttpError(400, `匹配画面总时长过长，请缩短文稿或精简分段`);
  }

  const summary =
    typeof raw.summary === "string" && raw.summary.trim()
      ? raw.summary.trim().slice(0, 200)
      : `共 ${segments.length} 段口播`;

  return { summary, voice, aspect, segments };
}

/**
 * @param {{ script: string, clips: object[], instruction?: string }} opts
 */
export async function generateVoiceoverPlan(opts) {
  const chatConfig = resolveChatConfig();
  if (!chatConfig) {
    throw new HttpError(503, "未配置 DEEPSEEK_API_KEY 或 ARK_API_KEY");
  }
  if (!isEdgeTtsAvailable()) {
    throw new HttpError(503, getEdgeTtsHint() || "语音合成不可用，请安装 edge-tts");
  }

  const script = normalizeScript(opts.script);
  const clips = opts.clips;
  if (!clips?.length) throw new HttpError(400, "请上传至少一个视频素材");

  const clipLines = clips.map(
    (c) =>
      `- clipIndex ${c.index}「${c.name}」：${c.duration.toFixed(2)}s，${c.width}×${c.height}，${c.hasAudio ? "有环境声" : "无音轨"}`,
  );

  const timeoutMs = Number(env("AI_VIDEO_EDIT_TIMEOUT_MS", "90000")) || 90000;
  const client = new OpenAI({
    apiKey: chatConfig.apiKey,
    baseURL: chatConfig.baseURL,
    timeout: timeoutMs,
    maxRetries: 0,
  });

  const userParts = [
    "【素材库】",
    ...clipLines,
    "",
    "【口播文稿】",
    script,
  ];
  if (opts.instruction?.trim()) {
    userParts.push("", "【剪辑要求】", opts.instruction.trim());
  }

  try {
    const completion = await client.chat.completions.create({
      model: chatConfig.model,
      messages: [
        { role: "system", content: VOICEOVER_SYSTEM_PROMPT },
        { role: "user", content: userParts.join("\n") },
      ],
      temperature: 0.25,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    const text = completion.choices?.[0]?.message?.content?.trim();
    if (!text) throw new HttpError(502, "AI 未返回口播方案");

    const parsed = parseAiJson(text);
    const plan = normalizeVoiceoverPlan(parsed, clips);
    return { ...plan, provider: getChatProviderLabel(chatConfig.provider) };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    const msg = e?.message || String(e);
    if (/401|invalid.*key/i.test(msg)) {
      throw new HttpError(503, `${getChatProviderLabel(chatConfig.provider)} API Key 无效`);
    }
    if (/timeout|timed out/i.test(msg)) {
      throw new HttpError(408, "AI 匹配超时，请缩短文稿后重试");
    }
    throw new HttpError(502, `生成口播方案失败：${msg.slice(0, 200)}`);
  }
}

async function probeAudioDuration(audioPath) {
  const { stdout } = await runFfprobe([
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    audioPath,
  ]);
  const d = parseFloat(stdout.trim());
  return Number.isFinite(d) && d > 0 ? d : 0;
}

function targetSize(clips, aspect) {
  const ref = clips[0];
  const aspectMap = { "16:9": 16 / 9, "9:16": 9 / 16, "1:1": 1, "4:3": 4 / 3 };
  const ratio = aspectMap[aspect] || 9 / 16;
  let w = ref.width || 1080;
  let h = ref.height || 1920;
  if (aspect === "9:16") {
    w = 1080;
    h = 1920;
  } else if (aspect === "16:9") {
    w = 1920;
    h = 1080;
  } else if (aspect === "1:1") {
    w = h = 1080;
  } else {
    h = Math.round(w / ratio / 2) * 2;
  }
  w = Math.min(1920, Math.max(320, Math.floor(w / 2) * 2));
  h = Math.min(1920, Math.max(320, Math.floor(h / 2) * 2));
  return { w, h };
}

/**
 * @param {{ plan: ReturnType<typeof normalizeVoiceoverPlan>, clips: { path: string }[], tmpDir: string, outputPath: string }} opts
 */
export async function renderVoiceoverVideo(opts) {
  const { plan, clips, tmpDir, outputPath } = opts;
  if (!isEdgeTtsAvailable()) {
    throw new HttpError(503, getEdgeTtsHint() || "语音合成不可用");
  }

  const { w, h } = targetSize(clips, plan.aspect);
  const scalePad = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1`;
  const segmentPaths = [];

  for (let i = 0; i < plan.segments.length; i++) {
    const seg = plan.segments[i];
    const clip = clips[seg.clipIndex];
    const voicePath = path.join(tmpDir, `voice-${i}.mp3`);
    await synthesizeSpeech({ text: seg.text, outputPath: voicePath, voice: plan.voice });

    const ttsDur = await probeAudioDuration(voicePath);
    if (ttsDur < 0.2) throw new HttpError(500, `第 ${i + 1} 段人声生成失败`);

    const clipDur = seg.clipEnd - seg.clipStart;
    const segOut = path.join(tmpDir, `vo-seg-${i}.mp4`);

    let vFilter = `trim=start=${seg.clipStart}:end=${seg.clipEnd},setpts=PTS-STARTPTS,${scalePad}`;
    if (clipDur < ttsDur - 0.05) {
      vFilter += `,tpad=stop_mode=clone:stop_duration=${(ttsDur - clipDur).toFixed(3)}`;
    } else if (clipDur > ttsDur + 0.05) {
      vFilter = `trim=start=${seg.clipStart}:duration=${ttsDur.toFixed(3)},setpts=PTS-STARTPTS,${scalePad}`;
    }

    await runFfmpeg([
      "-y",
      "-i",
      clip.path,
      "-i",
      voicePath,
      "-filter_complex",
      `[0:v]${vFilter}[v];[1:a]aformat=sample_rates=44100:channel_layouts=stereo[a]`,
      "-map",
      "[v]",
      "-map",
      "[a]",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-shortest",
      segOut,
    ]);
    segmentPaths.push(segOut);
  }

  if (segmentPaths.length === 1) {
    fs.copyFileSync(segmentPaths[0], outputPath);
    return;
  }

  const listPath = path.join(tmpDir, "vo-concat.txt");
  fs.writeFileSync(
    listPath,
    segmentPaths.map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n"),
  );
  await runFfmpeg([
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c",
    "copy",
    outputPath,
  ]);
}

export function getVoiceoverStatus() {
  const available = isEdgeTtsAvailable();
  return {
    ttsAvailable: available,
    hint: available ? null : getEdgeTtsHint(),
    voices: DEFAULT_TTS_VOICES,
    defaultVoice: getDefaultTtsVoice(),
    maxSegments: MAX_VOICEOVER_SEGMENTS,
    maxScriptChars: MAX_SCRIPT_CHARS,
  };
}
