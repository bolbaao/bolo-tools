import type { ClientPhotoItem } from "@/lib/agent-types";

/** 视觉 API 上传上限（字符数近似字节） */
export const MAX_PREVIEW_BYTES = 380_000;

export async function compressImageFile(
  file: File,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  let width = bitmap.width;
  let height = bitmap.height;
  /** 方舟视觉模型要求较短边不低于约 14px，上传前缩放到合理尺寸 */
  const maxDim = 1024;
  const minDim = 128;
  if (width > maxDim || height > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  if (Math.min(width, height) < minDim) {
    const scale = minDim / Math.min(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法处理图片");

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  let quality = 0.82;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length > MAX_PREVIEW_BYTES * 1.4 && quality > 0.45) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  return { dataUrl, width, height };
}

async function fileToChatImage(file: File): Promise<ClientPhotoItem> {
  const base: ClientPhotoItem = {
    name: file.name || "image.jpg",
    size: file.size,
    lastModified: file.lastModified || Date.now(),
    mimeType: file.type.startsWith("image/") ? file.type : "image/jpeg",
  };

  if (!file.type.startsWith("image/")) {
    throw new Error("仅支持图片文件");
  }

  const { dataUrl, width, height } = await compressImageFile(file);
  return { ...base, width, height, previewDataUrl: dataUrl };
}

export async function filesToChatImages(
  files: File[],
  maxCount = 4,
): Promise<ClientPhotoItem[]> {
  const images: ClientPhotoItem[] = [];
  for (const file of files.slice(0, maxCount)) {
    if (!file.type.startsWith("image/")) continue;
    images.push(await fileToChatImage(file));
  }
  return images;
}
