import type { AgentResponse, ClientPhotoItem } from "@/lib/agent-types";

export { imageNeedsVisionApi } from "../../shared/chat-image-vision.mjs";

export function photoItemKey(p: Pick<ClientPhotoItem, "name" | "lastModified" | "size">) {
  return `${p.name}:${p.lastModified}:${p.size}`;
}

function stripPreviewIfCached(img: ClientPhotoItem): ClientPhotoItem {
  if (!img.visionDescription) return img;
  const next = { ...img };
  delete next.previewDataUrl;
  return next;
}

/** 已识别成功的图片不再上传 base64，减轻请求体积 */
export function prepareChatImagesForApi(images: ClientPhotoItem[]): ClientPhotoItem[] {
  return images.map(stripPreviewIfCached);
}

export function mergeChatImageVision(
  images: ClientPhotoItem[],
  vision?: AgentResponse["chatImageVision"],
): ClientPhotoItem[] {
  if (!vision?.length) return images;
  const map = new Map(vision.map((v) => [photoItemKey(v), v]));
  return images.map((img) => {
    const hit = map.get(photoItemKey(img));
    if (!hit) return img;
    const next: ClientPhotoItem = {
      ...img,
      visionDescription: hit.description ?? img.visionDescription,
      visionProvider: hit.visionProvider ?? img.visionProvider,
      visionError: hit.error ?? img.visionError,
    };
    return hit.description ? stripPreviewIfCached(next) : next;
  });
}
