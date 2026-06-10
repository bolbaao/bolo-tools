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

const WATERMARK_PROMPTS = {
  light:
    "轻微去除图片角落或边缘的小型半透明水印、Logo 或文字，自然修复被遮挡区域，不改变画面主体内容与构图",
  standard:
    "去除图片上的水印、Logo、角标和叠加文字，智能修复背景，保持画面主体完整自然，不添加新水印",
  strong:
    "彻底清除图片中所有水印、文字标记、Logo 和半透明叠加层，对遮挡区域进行内容感知修复，尽量恢复干净画面",
};

/**
 * @param {{ imageDataUrl: string; level?: string; resolution?: string }} opts
 */
export async function removeWatermarkArkImage({ imageDataUrl, level = "standard", resolution = "2k" }) {
  const prompt = WATERMARK_PROMPTS[level] || WATERMARK_PROMPTS.standard;
  return editArkImage({ prompt, imageDataUrl, resolution });
}

/**
 * @param {{ imageDataUrl: string; backgroundPrompt?: string; resolution?: string }} opts
 */
export async function replaceBackgroundArkImage({
  imageDataUrl,
  backgroundPrompt,
  resolution = "2k",
}) {
  const bg = backgroundPrompt?.trim() || "简洁干净的纯色背景";
  const prompt = `将照片中主体的背景替换为：${bg}。完整保留前景人物或物品的细节、边缘和光影，主体不做变形，背景与主体自然融合，写实风格`;
  return editArkImage({ prompt, imageDataUrl, resolution });
}

const ERASE_PROMPTS = {
  light:
    "轻微去除图片中多余的小物体、路人或杂物，自然修复被遮挡区域，不改变画面主体与构图",
  standard:
    "智能消除图片中指定的多余物体、路人、电线或杂物，内容感知修复背景，保持画面主体完整自然",
  strong:
    "彻底清除图片中所有不需要的物体、文字标记、路人或遮挡物，对遮挡区域进行内容感知修复，尽量恢复干净画面",
};

/**
 * @param {{ imageDataUrl: string; level?: string; hint?: string; resolution?: string }} opts
 */
export async function eraseArkImage({
  imageDataUrl,
  level = "standard",
  hint,
  resolution = "2k",
}) {
  const base = ERASE_PROMPTS[level] || ERASE_PROMPTS.standard;
  const extra = hint?.trim() ? `，重点消除：${hint.trim()}` : "";
  return editArkImage({ prompt: base + extra, imageDataUrl, resolution });
}
