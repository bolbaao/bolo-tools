import { resolveArkConfig } from "./chat-config.mjs";
import { env } from "./env.mjs";

const DEFAULT_MODEL = "doubao-seedream-4-0-250828";

const SIZE_BY_RATIO = {
  "1:1": { "1k": "1024x1024", "2k": "2048x2048" },
  "16:9": { "1k": "1280x720", "2k": "2560x1440" },
  "9:16": { "1k": "720x1280", "2k": "1440x2560" },
  "4:3": { "1k": "1024x768", "2k": "2048x1536" },
  "3:2": { "1k": "1536x1024", "2k": "3072x2048" },
  "3:4": { "1k": "768x1024", "2k": "1536x2048" },
  "2:3": { "1k": "1024x1536", "2k": "2048x3072" },
};

function ensureArkNoProxy() {
  const host = "ark.cn-beijing.volces.com";
  const cur = process.env.NO_PROXY || process.env.no_proxy || "";
  if (!cur.split(",").some((h) => h.trim() === host)) {
    const next = [cur, host, "localhost", "127.0.0.1"].filter(Boolean).join(",");
    process.env.NO_PROXY = next;
    process.env.no_proxy = next;
  }
}

export function arkImageConfigured() {
  return Boolean(resolveArkConfig()?.apiKey);
}

function resolveSize(aspectRatio, resolution) {
  const res = resolution === "2k" ? "2k" : "1k";
  const ratio = SIZE_BY_RATIO[aspectRatio] ? aspectRatio : "1:1";
  return SIZE_BY_RATIO[ratio][res];
}

/**
 * @param {{ prompt: string; aspectRatio?: string; resolution?: string; style?: string }} opts
 */
export async function generateArkImage({ prompt, aspectRatio = "1:1", resolution = "1k", style }) {
  const cfg = resolveArkConfig();
  if (!cfg?.apiKey) throw new Error("ARK_KEYS_MISSING");

  ensureArkNoProxy();

  const fullPrompt = style?.trim() ? `${prompt.trim()}，风格：${style.trim()}` : prompt.trim();
  const size = resolveSize(aspectRatio, resolution);

  const response = await fetch(`${cfg.baseURL}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env("ARK_IMAGE_MODEL") || DEFAULT_MODEL,
      prompt: fullPrompt,
      size,
      response_format: "b64_json",
      watermark: false,
      sequential_image_generation: "disabled",
    }),
    signal: AbortSignal.timeout(180000),
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`火山方舟返回非 JSON（HTTP ${response.status}）`);
  }

  if (!response.ok) {
    const msg =
      data?.error?.message || data?.message || data?.detail || `火山方舟 HTTP ${response.status}`;
    throw new Error(msg);
  }

  const item = data?.data?.[0];
  if (!item) throw new Error("火山方舟未返回图片数据");

  if (item.b64_json) {
    return { imageBase64: item.b64_json, mimeType: "image/png" };
  }
  if (item.url) {
    return { imageUrl: item.url, mimeType: "image/png" };
  }
  throw new Error("火山方舟返回格式异常");
}

function parseImageResponse(data) {
  const item = data?.data?.[0];
  if (!item) throw new Error("火山方舟未返回图片数据");

  if (item.b64_json) {
    return { imageBase64: item.b64_json, mimeType: "image/png" };
  }
  if (item.url) {
    return { imageUrl: item.url, mimeType: "image/png" };
  }
  throw new Error("火山方舟返回格式异常");
}

/**
 * @param {{ prompt: string; imageDataUrl: string; resolution?: string }} opts
 */
export async function editArkImage({ prompt, imageDataUrl, resolution = "2k" }) {
  const cfg = resolveArkConfig();
  if (!cfg?.apiKey) throw new Error("ARK_KEYS_MISSING");

  const image = imageDataUrl?.trim();
  if (!image) throw new Error("请上传参考图片");
  if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(image)) {
    throw new Error("图片格式无效，请重新上传");
  }

  ensureArkNoProxy();

  const size = resolution === "1k" ? "1K" : "2K";

  const response = await fetch(`${cfg.baseURL}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env("ARK_IMAGE_MODEL") || DEFAULT_MODEL,
      prompt: prompt.trim(),
      image: [image],
      size,
      response_format: "b64_json",
      watermark: false,
      sequential_image_generation: "disabled",
    }),
    signal: AbortSignal.timeout(180000),
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`火山方舟返回非 JSON（HTTP ${response.status}）`);
  }

  if (!response.ok) {
    const msg =
      data?.error?.message || data?.message || data?.detail || `火山方舟 HTTP ${response.status}`;
    throw new Error(msg);
  }

  return parseImageResponse(data);
}

const BEAUTIFY_PROMPTS = {
  natural:
    "对照片中的人物进行自然人像美化：轻度磨皮匀肤、淡化瑕疵、自然提亮肤色与眼神，优化面部光影，效果清新自然，必须完全保留人物五官身份、发型、姿势、服装和背景，不做过度美颜",
  standard:
    "对照片中的人物进行智能人像美颜：磨皮匀肤、美白提亮、锐化眼神、轻微润色唇色与气色，优化面部光影让人更精神好看，保持人物可识别、真实自然，不改变背景与构图",
  pro: "对照片中的人物进行专业人像精修：精致磨皮、匀肤美白、亮眼、优化面部轮廓光泽与妆容感，提升整体气质与上镜效果，精修但不失真，必须保留人物身份特征，背景与原构图不变",
};

/**
 * @param {{ imageDataUrl: string; level?: string; resolution?: string }} opts
 */
export async function beautifyArkImage({ imageDataUrl, level = "standard", resolution = "2k" }) {
  const prompt = BEAUTIFY_PROMPTS[level] || BEAUTIFY_PROMPTS.standard;
  return editArkImage({ prompt, imageDataUrl, resolution });
}
