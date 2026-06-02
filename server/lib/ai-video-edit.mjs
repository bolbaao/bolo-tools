import fs from "fs";
import OpenAI from "openai";
import path from "path";
import { HttpError } from "./http-error.mjs";
import { getChatProviderLabel, resolveChatConfig } from "./chat-config.mjs";
import { env } from "./env.mjs";
import { runFfmpeg, runFfprobe } from "./ffmpeg-run.mjs";

export const MAX_VIDEO_EDIT_SEC = Number(env("MAX_VIDEO_EDIT_SEC", "300")) || 300;
export const MAX_VIDEO_EDIT_MB = Number(env("MAX_VIDEO_EDIT_MB", "200")) || 200;
export const MAX_VIDEO_EDIT_COUNT = Number(env("MAX_VIDEO_EDIT_COUNT", "10")) || 10;

const ASPECT_MAP = {
  "16:9": 16 / 9,
  "9:16": 9 / 16,
  "1:1": 1,
  "4:3": 4 / 3,
};

const SYSTEM_PROMPT = `你是视频剪辑助手。根据用户自然语言描述与视频元数据，输出 JSON 剪辑方案（不要 markdown 代码块）。

仅可使用以下 operations（按顺序排列，可省略不需要的）：
- trim: { "start": 秒, "end": 秒 } 裁剪时间段，start 默认 0，end 不超过视频时长
- crop_aspect: { "aspect": "16:9"|"9:16"|"1:1"|"4:3" } 居中裁剪画幅
- scale: { "maxWidth": 像素 } 或 { "width": 像素 }，范围 320–1920
- speed: { "factor": 0.5–2 } 变速（音视频同步）
- rotate: { "degrees": 90|180|270 }
- flip: { "axis": "horizontal"|"vertical" }
- brightness: { "value": -0.5–0.5 } 亮度微调
- contrast: { "value": -0.5–0.5 } 对比度微调
- volume: { "level": 0–2 } 音量，0 为静音
- remove_audio: {} 去掉音轨
- fade: { "op": "fade", "type": "in"|"out"|"both", "duration": 0.3–3 } 淡入淡出（秒）

输出格式：
{"summary":"一句话说明将做什么","operations":[{"op":"trim","start":0,"end":10},...]}

规则：
- 每一步必须包含字符串字段 "op"（操作名），不要用 type 代替 op
- fade 步骤：op 固定为 "fade"，淡入淡出方向写在 type 字段
- 时间请结合视频总时长，勿超出范围
- 若描述含糊，选最保守、常用的剪辑方式
- 不要编造不存在的 operation
- operations 最多 8 步`;

/**
 * @param {string} filePath
 */
export async function probeVideo(filePath) {
  const { stdout } = await runFfprobe([
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    filePath,
  ]);
  let data;
  try {
    data = JSON.parse(stdout);
  } catch {
    throw new HttpError(400, "无法读取视频信息");
  }

  const videoStream = (data.streams || []).find((s) => s.codec_type === "video");
  const audioStream = (data.streams || []).find((s) => s.codec_type === "audio");
  const duration = parseFloat(data.format?.duration || videoStream?.duration || "0");

  if (!videoStream || !Number.isFinite(duration) || duration <= 0) {
    throw new HttpError(400, "未检测到有效视频轨");
  }

  return {
    duration,
    width: videoStream.width || 0,
    height: videoStream.height || 0,
    hasAudio: Boolean(audioStream),
    format: data.format?.format_name || "",
  };
}

/**
 * @param {string[]} inputPaths
 * @param {string} tmpDir
 * @param {{ originalname?: string }[]} [fileInfos]
 */
export async function prepareVideoInput(inputPaths, tmpDir, fileInfos = []) {
  if (!inputPaths.length) throw new HttpError(400, "请上传视频文件");

  const clips = [];
  for (let i = 0; i < inputPaths.length; i++) {
    const meta = await probeVideo(inputPaths[i]);
    clips.push({
      index: i + 1,
      name: fileInfos[i]?.originalname || path.basename(inputPaths[i]),
      ...meta,
    });
  }

  const totalDuration = clips.reduce((s, c) => s + c.duration, 0);
  if (totalDuration > MAX_VIDEO_EDIT_SEC) {
    throw new HttpError(
      400,
      `视频总时长 ${totalDuration.toFixed(1)} 秒超过 ${MAX_VIDEO_EDIT_SEC} 秒上限`,
    );
  }

  if (inputPaths.length === 1) {
    return { inputPath: inputPaths[0], meta: clips[0], clips, multi: false };
  }

  const targetW = clips[0].width || 1280;
  const targetH = clips[0].height || 720;
  const normalized = [];

  for (let i = 0; i < inputPaths.length; i++) {
    const segPath = path.join(tmpDir, `seg-${i}.mp4`);
    const scalePad = `scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2,setsar=1`;
    if (clips[i].hasAudio) {
      await runFfmpeg([
        "-y",
        "-i",
        inputPaths[i],
        "-vf",
        scalePad,
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-b:a",
        "128k",
        segPath,
      ]);
    } else {
      await runFfmpeg([
        "-y",
        "-i",
        inputPaths[i],
        "-f",
        "lavfi",
        "-i",
        "anullsrc=channel_layout=stereo:sample_rate=44100",
        "-vf",
        scalePad,
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-shortest",
        segPath,
      ]);
    }
    normalized.push(segPath);
  }

  const mergedPath = path.join(tmpDir, "merged.mp4");
  const listPath = path.join(tmpDir, "concat-list.txt");
  const listBody = normalized
    .map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`)
    .join("\n");
  fs.writeFileSync(listPath, listBody);

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
    mergedPath,
  ]);

  const meta = await probeVideo(mergedPath);
  return { inputPath: mergedPath, meta, clips, multi: true, totalDuration };
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

const KNOWN_OPS = new Set([
  "trim",
  "crop_aspect",
  "scale",
  "speed",
  "rotate",
  "flip",
  "brightness",
  "contrast",
  "volume",
  "remove_audio",
  "fade",
]);

const OP_ALIASES = {
  cut: "trim",
  crop: "crop_aspect",
  resize: "scale",
  mute: "remove_audio",
  silent: "remove_audio",
  removeaudio: "remove_audio",
  "remove-audio": "remove_audio",
};

const ASPECT_ALIASES = {
  vertical: "9:16",
  portrait: "9:16",
  horizontal: "16:9",
  landscape: "16:9",
  square: "1:1",
};

const FADE_TYPES = new Set(["in", "out", "both"]);

function normalizeOpName(name) {
  const key = String(name).trim().toLowerCase().replace(/\s+/g, "_");
  return OP_ALIASES[key] || key;
}

/**
 * 将 AI 可能返回的多种步骤格式统一为 { op, ...params }
 * @param {unknown} item
 * @param {number} index
 */
function coerceOperationItem(item, index) {
  const stepLabel = `第 ${index + 1} 步`;

  if (item == null) {
    throw new HttpError(400, `剪辑方案${stepLabel}无效`);
  }

  if (typeof item === "string") {
    const op = normalizeOpName(item);
    if (KNOWN_OPS.has(op)) return { op };
    throw new HttpError(400, `剪辑方案${stepLabel}无法识别：${item}`);
  }

  if (typeof item !== "object") {
    throw new HttpError(400, `剪辑方案${stepLabel}格式无效`);
  }

  /** @type {Record<string, unknown>} */
  const obj = item;

  // { "trim": { "start": 0, "end": 5 } }
  if (!obj.op && !obj.operation && !obj.action && !obj.name) {
    const opKeys = Object.keys(obj).filter((k) => KNOWN_OPS.has(normalizeOpName(k)));
    if (opKeys.length === 1) {
      const op = normalizeOpName(opKeys[0]);
      const payload = obj[opKeys[0]];
      const params =
        typeof payload === "object" && payload !== null && !Array.isArray(payload)
          ? payload
          : {};
      return { op, ...params };
    }
  }

  // 仅有 fade 的 type + duration，无 op
  if (
    !obj.op &&
    !obj.operation &&
    !obj.action &&
    !obj.name &&
    typeof obj.type === "string" &&
    FADE_TYPES.has(obj.type) &&
    obj.duration != null
  ) {
    return { op: "fade", type: obj.type, duration: obj.duration };
  }

  let opName = obj.op ?? obj.operation ?? obj.action ?? obj.name;
  if (typeof opName === "string") {
    opName = normalizeOpName(opName);
  } else if (typeof obj.type === "string" && KNOWN_OPS.has(normalizeOpName(obj.type))) {
    opName = normalizeOpName(obj.type);
  } else {
    throw new HttpError(400, `剪辑方案${stepLabel}缺少 op 操作名`);
  }

  return { ...obj, op: opName };
}

function parseOperationsList(raw) {
  if (!raw || typeof raw !== "object") return [];
  const body = raw.plan && typeof raw.plan === "object" ? raw.plan : raw;
  let ops = body.operations ?? body.ops;
  if (typeof ops === "string") {
    try {
      ops = JSON.parse(ops);
    } catch {
      throw new HttpError(400, "剪辑方案 operations 格式无效");
    }
  }
  return Array.isArray(ops) ? ops : [];
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
    if (start >= 0 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
    throw new HttpError(502, "AI 返回的剪辑方案无法解析");
  }
}

function validateOperation(op, meta, effectiveDuration) {
  if (!op || typeof op !== "object" || typeof op.op !== "string") {
    throw new HttpError(400, "剪辑方案格式无效");
  }

  switch (op.op) {
    case "trim": {
      const start = clamp(Number(op.start) || 0, 0, meta.duration);
      let end = op.end != null ? Number(op.end) : effectiveDuration;
      if (!Number.isFinite(end)) end = effectiveDuration;
      end = clamp(end, start + 0.1, meta.duration);
      return { op: "trim", start, end };
    }
    case "crop_aspect": {
      const rawAspect = String(op.aspect || op.ratio || op.aspectRatio || "").trim();
      const aspect =
        ASPECT_MAP[rawAspect] != null
          ? rawAspect
          : ASPECT_ALIASES[rawAspect.toLowerCase()] || rawAspect;
      if (!ASPECT_MAP[aspect]) throw new HttpError(400, `不支持的画幅 ${rawAspect}`);
      return { op: "crop_aspect", aspect };
    }
    case "scale": {
      const maxWidth = op.maxWidth != null ? clamp(Number(op.maxWidth), 320, 1920) : null;
      const width = op.width != null ? clamp(Number(op.width), 320, 1920) : null;
      if (!maxWidth && !width) throw new HttpError(400, "scale 需要 maxWidth 或 width");
      return { op: "scale", maxWidth: maxWidth || undefined, width: width || undefined };
    }
    case "speed": {
      const factor = clamp(Number(op.factor) || 1, 0.25, 4);
      return { op: "speed", factor };
    }
    case "rotate": {
      const degrees = Number(op.degrees);
      if (![90, 180, 270].includes(degrees)) throw new HttpError(400, "rotate 仅支持 90/180/270");
      return { op: "rotate", degrees };
    }
    case "flip": {
      const axis = op.axis === "vertical" ? "vertical" : "horizontal";
      return { op: "flip", axis };
    }
    case "brightness": {
      const value = clamp(Number(op.value) || 0, -0.5, 0.5);
      return { op: "brightness", value };
    }
    case "contrast": {
      const value = clamp(Number(op.value) || 0, -0.5, 0.5);
      return { op: "contrast", value };
    }
    case "volume": {
      const level = clamp(Number(op.level) ?? 1, 0, 2);
      return { op: "volume", level };
    }
    case "remove_audio":
      return { op: "remove_audio" };
    case "fade": {
      const type = ["in", "out", "both"].includes(op.type) ? op.type : "out";
      const duration = clamp(Number(op.duration) || 1, 0.3, 3);
      return { op: "fade", type, duration };
    }
    default:
      throw new HttpError(400, `不支持的剪辑操作：${op.op}`);
  }
}

export function normalizeEditPlan(raw, meta) {
  if (!raw || typeof raw !== "object") throw new HttpError(400, "剪辑方案无效");
  const opsIn = parseOperationsList(raw);
  if (opsIn.length === 0) throw new HttpError(400, "剪辑方案为空，请换一种描述");
  if (opsIn.length > 8) throw new HttpError(400, "剪辑步骤过多，请简化描述");

  let effectiveDuration = meta.duration;
  const operations = [];
  let removeAudio = false;

  for (let i = 0; i < opsIn.length; i++) {
    const coerced = coerceOperationItem(opsIn[i], i);
    const validated = validateOperation(coerced, meta, effectiveDuration);
    if (validated.op === "trim") {
      effectiveDuration = validated.end - validated.start;
    }
    if (validated.op === "remove_audio") removeAudio = true;
    operations.push(validated);
  }

  const summary =
    typeof raw.summary === "string" && raw.summary.trim()
      ? raw.summary.trim().slice(0, 200)
      : operations.map((o) => o.op).join(" → ");

  return { summary, operations, effectiveDuration, removeAudio };
}

/**
 * @param {{
 *   instruction: string,
 *   meta: { duration: number, width: number, height: number, hasAudio: boolean },
 *   clips?: { index: number, name: string, duration: number, width: number, height: number, hasAudio: boolean }[],
 * }} opts
 */
export async function generateEditPlan(opts) {
  const chatConfig = resolveChatConfig();
  if (!chatConfig) {
    throw new HttpError(
      503,
      "未配置 DEEPSEEK_API_KEY 或 ARK_API_KEY。请在 .env 配置后重启。",
    );
  }

  const instruction = opts.instruction?.trim();
  if (!instruction) throw new HttpError(400, "请描述想要的剪辑效果");

  const meta = opts.meta;
  if (meta.duration > MAX_VIDEO_EDIT_SEC) {
    throw new HttpError(
      400,
      `视频时长超过 ${MAX_VIDEO_EDIT_SEC} 秒上限，请先裁剪较短片段`,
    );
  }

  const timeoutMs = Number(env("AI_VIDEO_EDIT_TIMEOUT_MS", "90000")) || 90000;
  const client = new OpenAI({
    apiKey: chatConfig.apiKey,
    baseURL: chatConfig.baseURL,
    timeout: timeoutMs,
    maxRetries: 0,
  });

  const lines = [];
  if (opts.clips && opts.clips.length > 1) {
    lines.push(
      `共 ${opts.clips.length} 个片段（已按上传顺序拼接为一条时间线）：`,
      ...opts.clips.map(
        (c) =>
          `- 第${c.index}段「${c.name}」：${c.duration.toFixed(2)}s，${c.width}×${c.height}，${c.hasAudio ? "含音频" : "无音频"}`,
      ),
      `拼接后总时长：${meta.duration.toFixed(2)} 秒`,
      `拼接后分辨率：${meta.width}×${meta.height}`,
      `拼接后含音轨：${meta.hasAudio ? "是" : "否"}`,
    );
  } else {
    lines.push(
      `视频时长：${meta.duration.toFixed(2)} 秒`,
      `分辨率：${meta.width}×${meta.height}`,
      `含音轨：${meta.hasAudio ? "是" : "否"}`,
    );
  }
  lines.push("", `用户要求：${instruction}`);
  const userContent = lines.join("\n");

  try {
    const completion = await client.chat.completions.create({
      model: chatConfig.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0.2,
      max_tokens: 1200,
      response_format: { type: "json_object" },
    });

    const text = completion.choices?.[0]?.message?.content?.trim();
    if (!text) throw new HttpError(502, "AI 未返回剪辑方案");

    const parsed = parseAiJson(text);
    const plan = normalizeEditPlan(parsed, meta);
    return {
      ...plan,
      provider: getChatProviderLabel(chatConfig.provider),
    };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    const msg = e?.message || String(e);
    if (/401|invalid.*key/i.test(msg)) {
      throw new HttpError(503, `${getChatProviderLabel(chatConfig.provider)} API Key 无效`);
    }
    if (/timeout|timed out|AbortError/i.test(msg)) {
      throw new HttpError(408, "AI 解析超时，请简化描述后重试");
    }
    throw new HttpError(502, `生成剪辑方案失败：${msg.slice(0, 200)}`);
  }
}

function cropFilter(meta, aspectKey) {
  const target = ASPECT_MAP[aspectKey];
  const w = meta.width;
  const h = meta.height;
  if (!w || !h) return null;
  const sourceAspect = w / h;
  let cw;
  let ch;
  if (sourceAspect > target) {
    ch = h;
    cw = Math.floor((h * target) / 2) * 2;
  } else {
    cw = w;
    ch = Math.floor(w / target / 2) * 2;
  }
  const x = Math.floor((w - cw) / 2 / 2) * 2;
  const y = Math.floor((h - ch) / 2 / 2) * 2;
  return `crop=${cw}:${ch}:${x}:${y}`;
}

function buildAtempoChain(factor) {
  const filters = [];
  let f = factor;
  while (f > 2) {
    filters.push("atempo=2");
    f /= 2;
  }
  while (f < 0.5) {
    filters.push("atempo=0.5");
    f /= 0.5;
  }
  if (Math.abs(f - 1) > 0.01) filters.push(`atempo=${f.toFixed(4)}`);
  return filters;
}

/**
 * @param {{ inputPath: string, outputPath: string, plan: ReturnType<typeof normalizeEditPlan>, meta: object }} opts
 */
export async function renderEditedVideo(opts) {
  const { inputPath, outputPath, plan, meta } = opts;
  const vFilters = [];
  const aFilters = [];
  let removeAudio = plan.removeAudio;
  let speedFactor = 1;
  let trimStart = 0;
  let trimEnd = meta.duration;
  let fadeOp = null;

  for (const op of plan.operations) {
    switch (op.op) {
      case "trim":
        trimStart = op.start;
        trimEnd = op.end;
        break;
      case "crop_aspect": {
        const f = cropFilter(meta, op.aspect);
        if (f) vFilters.push(f);
        break;
      }
      case "scale":
        if (op.width) vFilters.push(`scale=${op.width}:-2`);
        else vFilters.push(`scale='min(${op.maxWidth},iw)':-2`);
        break;
      case "speed":
        speedFactor *= op.factor;
        break;
      case "rotate":
        if (op.degrees === 90) vFilters.push("transpose=1");
        else if (op.degrees === 270) vFilters.push("transpose=2");
        else if (op.degrees === 180) vFilters.push("hflip,vflip");
        break;
      case "flip":
        vFilters.push(op.axis === "vertical" ? "vflip" : "hflip");
        break;
      case "brightness":
        if (Math.abs(op.value) > 0.01) vFilters.push(`eq=brightness=${op.value}`);
        break;
      case "contrast":
        if (Math.abs(op.value) > 0.01) vFilters.push(`eq=contrast=${1 + op.value}`);
        break;
      case "volume":
        if (op.level === 0) removeAudio = true;
        else if (Math.abs(op.level - 1) > 0.01) aFilters.push(`volume=${op.level}`);
        break;
      case "remove_audio":
        removeAudio = true;
        break;
      case "fade":
        fadeOp = op;
        break;
      default:
        break;
    }
  }

  const clipDur = trimEnd - trimStart;
  const outDur = clipDur / speedFactor;

  vFilters.unshift(`trim=start=${trimStart}:end=${trimEnd},setpts=PTS-STARTPTS`);
  if (Math.abs(speedFactor - 1) > 0.01) {
    vFilters.push(`setpts=PTS/${speedFactor}`);
  }

  if (fadeOp) {
    const d = fadeOp.duration;
    if (fadeOp.type === "in" || fadeOp.type === "both") {
      vFilters.push(`fade=t=in:st=0:d=${d}`);
    }
    if (fadeOp.type === "out" || fadeOp.type === "both") {
      const st = Math.max(0, outDur - d);
      vFilters.push(`fade=t=out:st=${st}:d=${d}`);
    }
  }

  const args = ["-y", "-i", inputPath];

  if (removeAudio || !meta.hasAudio) {
    args.push("-vf", vFilters.join(","), "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "23", outputPath);
  } else {
    const aChain = [`atrim=start=${trimStart}:end=${trimEnd}`, "asetpts=PTS-STARTPTS"];
    if (Math.abs(speedFactor - 1) > 0.01) {
      aChain.push(...buildAtempoChain(speedFactor));
    }
    if (fadeOp) {
      const d = fadeOp.duration;
      if (fadeOp.type === "in" || fadeOp.type === "both") {
        aChain.push(`afade=t=in:st=0:d=${d}`);
      }
      if (fadeOp.type === "out" || fadeOp.type === "both") {
        const st = Math.max(0, outDur - d);
        aChain.push(`afade=t=out:st=${st}:d=${d}`);
      }
    }
    aChain.push(...aFilters);

    args.push(
      "-vf",
      vFilters.join(","),
      "-af",
      aChain.join(","),
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
      "-movflags",
      "+faststart",
      outputPath,
    );
  }

  await runFfmpeg(args);
}

export function safeOutputName(originalName, clipCount = 1) {
  if (clipCount > 1) return "merged_edited.mp4";
  const base = path.basename(originalName || "video", path.extname(originalName || ""));
  const safe = String(base)
    .replace(/[^\w\u4e00-\u9fa5.-]+/g, "_")
    .slice(0, 80);
  return `${safe || "video"}_edited.mp4`;
}
