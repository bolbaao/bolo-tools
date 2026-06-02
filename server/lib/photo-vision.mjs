import { IMAGE_VISION_UNAVAILABLE, sanitizeVisionApiError } from "../../shared/public-error.mjs";
import { resolveArkConfig } from "./chat-config.mjs";
import { env } from "./env.mjs";

const ARK_VISION_MODEL_DEFAULT = "doubao-1-5-vision-pro-32k-250115";
const VISION_PROVIDER_LABEL = "火山方舟";

/** 对外展示的识图错误（内部 snapshot 仍保留原始 error） */
function visionErrorForUser(raw) {
  if (raw == null || String(raw).trim() === "") return undefined;
  return sanitizeVisionApiError(raw);
}

const DESCRIBE_BASE =
  "用中文简要描述这张照片的内容、场景和主要物体（3～5 句），不要编造看不清的细节。";

/** @returns {{ apiKey: string; baseURL: string; model: string } | null} */
function resolveVisionConfig() {
  const ark = resolveArkConfig();
  if (!ark) return null;
  return {
    apiKey: ark.apiKey,
    baseURL: ark.baseURL,
    model: env("ARK_VISION_MODEL") || ARK_VISION_MODEL_DEFAULT,
  };
}

export function photoVisionConfigured() {
  return Boolean(resolveVisionConfig()?.apiKey);
}

export function activeVisionProviderLabel() {
  return resolveVisionConfig() ? VISION_PROVIDER_LABEL : null;
}

function buildDescribePrompt(userContext) {
  const ctx = typeof userContext === "string" ? userContext.trim().slice(0, 500) : "";
  if (!ctx) return DESCRIBE_BASE;
  return `${DESCRIBE_BASE}\n\n用户相关问题或说明：${ctx}\n请侧重与用户问题相关的可见信息。`;
}

/**
 * @param {{ apiKey: string; baseURL: string; model: string }} cfg
 * @param {string} dataUrl
 * @param {string} [userContext]
 */
function ensureArkNoProxy() {
  const host = "ark.cn-beijing.volces.com";
  const cur = process.env.NO_PROXY || process.env.no_proxy || "";
  if (!cur.split(",").some((h) => h.trim() === host)) {
    const next = [cur, host, "localhost", "127.0.0.1"].filter(Boolean).join(",");
    process.env.NO_PROXY = next;
    process.env.no_proxy = next;
  }
}

async function describeWithProvider(cfg, dataUrl, userContext) {
  ensureArkNoProxy();
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
            { type: "text", text: buildDescribePrompt(userContext) },
          ],
        },
      ],
      max_tokens: 512,
      temperature: 0.2,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errBody =
      typeof data?.error === "string"
        ? data.error
        : data?.error?.message || data?.message || data?.code;
    const msg = errBody ? String(errBody) : `vision HTTP ${response.status}`;
    const err = new Error(msg);
    err.status = response.status;
    throw err;
  }

  const text = data?.choices?.[0]?.message?.content?.trim();
  return text || null;
}

/**
 * @param {string} dataUrl
 * @param {string} [userContext]
 * @returns {Promise<{ description: string | null; providerLabel: string } | null>}
 */
export async function describePhotoDataUrl(dataUrl, userContext) {
  const cfg = resolveVisionConfig();
  if (!cfg) return null;

  const description = await describeWithProvider(cfg, dataUrl, userContext);
  return { description, providerLabel: VISION_PROVIDER_LABEL };
}

function visionMissingHint() {
  return `（${IMAGE_VISION_UNAVAILABLE}）`;
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

/**
 * @param {object} img
 * @param {string} [userContext]
 */
async function describeOneImage(img, userContext) {
  if (img.visionDescription) {
    return {
      description: img.visionDescription,
      error: img.visionError ?? null,
      visionProvider: img.visionProvider ?? null,
    };
  }

  let description = null;
  let error = null;
  let visionProvider = null;

  if (img.previewDataUrl) {
    if (!photoVisionConfigured()) {
      error = IMAGE_VISION_UNAVAILABLE;
    } else {
      try {
        const result = await describePhotoDataUrl(img.previewDataUrl, userContext);
        description = result?.description ?? null;
        visionProvider = result?.providerLabel ?? VISION_PROVIDER_LABEL;
        if (!description) {
          error = "模型未返回描述";
        }
      } catch (e) {
        error = e.message;
      }
    }
  }

  return { description, error, visionProvider };
}

/**
 * @param {object[]} chatImages
 * @param {{ userContext?: string }} [opts]
 */
export async function resolveChatImagesSnapshot(chatImages, opts = {}) {
  if (!Array.isArray(chatImages) || !chatImages.length) return null;

  const userContext = opts.userContext;
  const withPreview = chatImages
    .filter((i) => i?.previewDataUrl || i?.visionDescription)
    .slice(0, 6);
  if (!withPreview.length) {
    return { error: "图片未包含可识别数据" };
  }

  const results = await Promise.all(
    withPreview.map(async (img, i) => {
      const { description, error, visionProvider } = await describeOneImage(img, userContext);
      return {
        index: i + 1,
        name: img.name,
        lastModified: img.lastModified,
        size: img.size,
        width: img.width,
        height: img.height,
        description,
        error,
        visionProvider,
      };
    }),
  );

  return { count: withPreview.length, items: results };
}

export function formatChatImagesForPrompt(snapshot) {
  if (!snapshot) return "";
  if (snapshot.error) {
    return `\n【对话图片】${snapshot.error}`;
  }

  const lines = [`共 ${snapshot.count ?? snapshot.items?.length ?? 0} 张`];
  for (const item of snapshot.items ?? []) {
    lines.push(`图${item.index}「${item.name}」${item.width ?? "?"}×${item.height ?? "?"}`);
    if (item.description) {
      const via = item.visionProvider ? `（${item.visionProvider}）` : "";
      lines.push(`  识别${via}: ${item.description}`);
    } else if (item.error) {
      lines.push(`  识别失败: ${visionErrorForUser(item.error)}`);
    }
  }

  if (!photoVisionConfigured() && !lines.some((l) => l.includes("识别"))) {
    lines.push(visionMissingHint());
  }

  return `\n【对话图片识别（请据实回答，勿说看不到图片）】\n${lines.join("\n")}`;
}

export function chatImageVisionPayload(snapshot) {
  if (!snapshot?.items?.length) return [];
  return snapshot.items.map((item) => ({
    name: item.name,
    lastModified: item.lastModified,
    size: item.size,
    description: item.description ?? undefined,
    error: visionErrorForUser(item.error),
    visionProvider: item.visionProvider ?? undefined,
  }));
}

export async function resolveAllImageContext(pageContext, opts = {}) {
  const chatSnap = await resolveChatImagesSnapshot(pageContext?.chatImages, opts);
  const albumSnap = await resolvePhotoSnapshot(pageContext, opts);
  return { chatSnap, albumSnap };
}

export async function resolvePhotoSnapshot(pageContext, opts = {}) {
  const photos = pageContext?.clientPermissions?.photos;
  if (!photos || photos.status !== "granted" || !Array.isArray(photos.items) || !photos.items.length) {
    return null;
  }

  const primary = photos.items[0];
  try {
    if (primary.previewDataUrl || primary.visionDescription) {
      const { description, error, visionProvider } = await describeOneImage(
        primary,
        opts.userContext,
      );
      if (error) {
        return {
          count: photos.items.length,
          primary: {
            name: primary.name,
            width: primary.width,
            height: primary.height,
            lastModified: primary.lastModified,
          },
          error: `图像识别失败: ${visionErrorForUser(error)}`,
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
    return { error: visionErrorForUser(e.message) ?? "处理照片失败" };
  }
}
