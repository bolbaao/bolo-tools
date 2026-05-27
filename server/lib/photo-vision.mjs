import { env } from "./env.mjs";

const XAI_BASE = "https://api.x.ai/v1";
const XAI_VISION_MODEL = "grok-2-vision-1212";
const DEEPSEEK_DEFAULT_BASE = "https://api.deepseek.com/v1";
const DEEPSEEK_VISION_MODEL_DEFAULT = "deepseek-v4-pro";

const DESCRIBE_PROMPT =
  "用中文简要描述这张照片的内容、场景和主要物体（3～5 句），不要编造看不清的细节。";

/**
 * @returns {{ provider: string; apiKey: string; baseURL: string; model: string } | null}
 */
function resolveVisionConfig() {
  const mode = (env("IMAGE_VISION_PROVIDER", "auto") || "auto").toLowerCase();

  const xai = {
    provider: "xai",
    apiKey: env("XAI_API_KEY")?.trim(),
    baseURL: (env("XAI_BASE_URL") || XAI_BASE).replace(/\/$/, ""),
    model: env("XAI_VISION_MODEL") || XAI_VISION_MODEL,
  };

  const deepseek = {
    provider: "deepseek",
    apiKey: env("DEEPSEEK_API_KEY")?.trim(),
    baseURL: (env("DEEPSEEK_BASE_URL") || DEEPSEEK_DEFAULT_BASE).replace(/\/$/, ""),
    model: env("DEEPSEEK_VISION_MODEL") || DEEPSEEK_VISION_MODEL_DEFAULT,
  };

  if (mode === "xai") return xai.apiKey ? xai : null;
  if (mode === "deepseek") return deepseek.apiKey ? deepseek : null;

  // auto：优先 DeepSeek（与对话同一 Key），失败时由调用方回退 xAI
  if (deepseek.apiKey) return deepseek;
  if (xai.apiKey) return xai;
  return null;
}

function visionFallbackConfig(excludeProvider) {
  if (excludeProvider === "deepseek") {
    const key = env("XAI_API_KEY")?.trim();
    if (!key) return null;
    return {
      provider: "xai",
      apiKey: key,
      baseURL: (env("XAI_BASE_URL") || XAI_BASE).replace(/\/$/, ""),
      model: env("XAI_VISION_MODEL") || XAI_VISION_MODEL,
    };
  }
  const key = env("DEEPSEEK_API_KEY")?.trim();
  if (!key) return null;
  return {
    provider: "deepseek",
    apiKey: key,
    baseURL: (env("DEEPSEEK_BASE_URL") || DEEPSEEK_DEFAULT_BASE).replace(/\/$/, ""),
    model: env("DEEPSEEK_VISION_MODEL") || DEEPSEEK_VISION_MODEL_DEFAULT,
  };
}

export function photoVisionConfigured() {
  return Boolean(resolveVisionConfig()?.apiKey);
}

export function activeVisionProviderLabel() {
  const c = resolveVisionConfig();
  if (!c) return null;
  return c.provider === "deepseek" ? "DeepSeek" : "xAI";
}

/**
 * @param {string} dataUrl data:image/...;base64,...
 */
async function describeWithProvider(cfg, dataUrl) {
  const response = await fetch(`${cfg.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            { type: "text", text: DESCRIBE_PROMPT },
          ],
        },
      ],
      max_tokens: 400,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = data?.error?.message || `vision HTTP ${response.status}`;
    const err = new Error(msg);
    err.provider = cfg.provider;
    err.status = response.status;
    throw err;
  }

  const text = data?.choices?.[0]?.message?.content?.trim();
  return text || null;
}

function isDeepSeekVisionUnsupported(err) {
  const msg = err?.message || "";
  return (
    err?.provider === "deepseek" &&
    (/image_url|unknown variant|expected `text`/i.test(msg) ||
      err?.status === 400)
  );
}

/**
 * @param {string} dataUrl
 */
export async function describePhotoDataUrl(dataUrl) {
  const primary = resolveVisionConfig();
  if (!primary) return null;

  try {
    return await describeWithProvider(primary, dataUrl);
  } catch (err) {
    if (isDeepSeekVisionUnsupported(err)) {
      const fallback = visionFallbackConfig("deepseek");
      if (fallback?.provider === "xai") {
        return describeWithProvider(fallback, dataUrl);
      }
      throw new Error(
        "DeepSeek 对话 API 暂不支持图片输入（deepseek-chat / v4 文本接口均如此）。请配置 XAI_API_KEY 识别图片，或等待 DeepSeek 开放视觉 API。",
      );
    }
    throw err;
  }
}

function visionMissingHint() {
  const mode = (env("IMAGE_VISION_PROVIDER", "auto") || "auto").toLowerCase();
  if (mode === "deepseek") {
    return "（DeepSeek 视觉：当前云端 API 尚不支持 image_url，请设 IMAGE_VISION_PROVIDER=xai 并配置 XAI_API_KEY）";
  }
  return "（请配置 XAI_API_KEY，或 IMAGE_VISION_PROVIDER=deepseek + DEEPSEEK_API_KEY 待官方支持视觉）";
}

export function formatPhotoSnapshotForPrompt(snapshot) {
  if (!snapshot) return "";
  if (snapshot.error) {
    return `\n【相册/照片】${snapshot.error}`;
  }

  const lines = [`共 ${snapshot.count} 张`];
  if (snapshot.primary) {
    const p = snapshot.primary;
    lines.push(
      `用户选定主图（按拍摄/修改时间最早）: ${p.name}`,
      `尺寸: ${p.width ?? "?"}×${p.height ?? "?"}`,
      `文件时间: ${p.lastModified}`,
    );
  }
  if (snapshot.description) {
    const via = snapshot.visionProvider ? `（${snapshot.visionProvider}）` : "";
    lines.push(`图像识别${via}: ${snapshot.description}`);
  } else if (!photoVisionConfigured()) {
    lines.push(visionMissingHint());
  }

  return `\n【用户相册照片（请据实回答，勿说无法查看相册）】\n${lines.join("\n")}`;
}

function stripDataUrlForPrompt(items) {
  return items.map(({ previewDataUrl: _p, ...rest }) => rest);
}

async function describeOneImage(img) {
  let description = null;
  let error = null;
  let visionProvider = null;

  if (photoVisionConfigured() && img.previewDataUrl) {
    try {
      description = await describePhotoDataUrl(img.previewDataUrl);
      visionProvider = activeVisionProviderLabel();
    } catch (e) {
      error = e.message;
    }
  }

  return { description, error, visionProvider };
}

/**
 * 对话中用户上传/粘贴的图片（pageContext.chatImages）
 */
export async function resolveChatImagesSnapshot(chatImages) {
  if (!Array.isArray(chatImages) || !chatImages.length) return null;

  const withPreview = chatImages.filter((i) => i?.previewDataUrl).slice(0, 6);
  if (!withPreview.length) {
    return {
      error: "图片未包含可识别数据",
      items: stripDataUrlForPrompt(chatImages),
    };
  }

  const results = [];
  for (let i = 0; i < withPreview.length; i++) {
    const img = withPreview[i];
    const { description, error, visionProvider } = await describeOneImage(img);
    results.push({
      index: i + 1,
      name: img.name,
      width: img.width,
      height: img.height,
      description,
      error,
      visionProvider,
    });
  }

  return { count: withPreview.length, items: results };
}

export function formatChatImagesForPrompt(snapshot) {
  if (!snapshot) return "";
  if (snapshot.error && !snapshot.items?.length) {
    return `\n【对话图片】${snapshot.error}`;
  }

  const lines = [`共 ${snapshot.count ?? snapshot.items?.length ?? 0} 张`];
  for (const item of snapshot.items ?? []) {
    lines.push(`图${item.index}「${item.name}」${item.width ?? "?"}×${item.height ?? "?"}`);
    if (item.description) {
      const via = item.visionProvider ? `（${item.visionProvider}）` : "";
      lines.push(`  识别${via}: ${item.description}`);
    } else if (item.error) {
      lines.push(`  识别失败: ${item.error}`);
    }
  }

  if (!photoVisionConfigured() && !lines.some((l) => l.includes("识别"))) {
    lines.push(visionMissingHint());
  }

  return `\n【对话图片识别（请据实回答，勿说看不到图片）】\n${lines.join("\n")}`;
}

export async function resolveAllImageContext(pageContext) {
  const chatSnap = await resolveChatImagesSnapshot(pageContext?.chatImages);
  const albumSnap = await resolvePhotoSnapshot(pageContext);
  return { chatSnap, albumSnap };
}

export async function resolvePhotoSnapshot(pageContext) {
  const photos = pageContext?.clientPermissions?.photos;
  if (!photos || photos.status !== "granted" || !Array.isArray(photos.items) || !photos.items.length) {
    return null;
  }

  const primary = photos.items[0];
  try {
    if (primary.previewDataUrl) {
      const { description, error, visionProvider } = await describeOneImage(primary);
      if (error) {
        return {
          count: photos.items.length,
          primary: {
            name: primary.name,
            width: primary.width,
            height: primary.height,
            lastModified: primary.lastModified,
          },
          error: `图像识别失败: ${error}`,
        };
      }

      return {
        count: photos.items.length,
        primary: {
          name: primary.name,
          width: primary.width,
          height: primary.height,
          lastModified: primary.lastModified,
        },
        description,
        visionProvider,
      };
    }

    return {
      count: photos.items.length,
      primary: {
        name: primary.name,
        width: primary.width,
        height: primary.height,
        lastModified: primary.lastModified,
      },
    };
  } catch (e) {
    return { error: e.message || "处理照片失败" };
  }
}
