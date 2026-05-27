import { env } from "./env.mjs";

const XAI_BASE = "https://api.x.ai/v1";
const DEFAULT_MODEL = "grok-imagine-image-quality";

const ASPECT_RATIOS = new Set([
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
  "2:1",
  "1:2",
  "auto",
]);

export function xaiConfigured() {
  return Boolean(env("XAI_API_KEY")?.trim());
}

/**
 * @param {{ prompt: string; aspectRatio?: string; resolution?: string; style?: string }} opts
 */
export async function generateXaiImage({ prompt, aspectRatio = "1:1", resolution = "1k", style }) {
  const apiKey = env("XAI_API_KEY")?.trim();
  if (!apiKey) throw new Error("XAI_KEYS_MISSING");

  const baseURL = (env("XAI_BASE_URL") || XAI_BASE).replace(/\/$/, "");
  const fullPrompt = style?.trim() ? `${prompt.trim()}，风格：${style.trim()}` : prompt.trim();
  const ratio = ASPECT_RATIOS.has(aspectRatio) ? aspectRatio : "1:1";
  const res = resolution === "2k" ? "2k" : "1k";

  const response = await fetch(`${baseURL}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env("XAI_IMAGE_MODEL") || DEFAULT_MODEL,
      prompt: fullPrompt,
      n: 1,
      aspect_ratio: ratio,
      resolution: res,
      response_format: "b64_json",
    }),
    signal: AbortSignal.timeout(180000),
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`xAI 返回非 JSON（HTTP ${response.status}）`);
  }

  if (!response.ok) {
    const msg =
      data?.error?.message || data?.message || data?.detail || `xAI HTTP ${response.status}`;
    throw new Error(msg);
  }

  const item = data?.data?.[0];
  if (!item) throw new Error("xAI 未返回图片数据");

  if (item.b64_json) {
    return { imageBase64: item.b64_json, mimeType: "image/png" };
  }
  if (item.url) {
    return { imageUrl: item.url, mimeType: "image/png" };
  }
  throw new Error("xAI 返回格式异常");
}
