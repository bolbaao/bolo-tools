import type { AgentResponse, ChatImageVisionItem, ClientPhotoItem } from "@/lib/agent-types";
import { IMAGE_VISION_UNAVAILABLE, toUserFacingErrorMessage } from "@/lib/service-message";

export { imageNeedsVisionApi } from "../../shared/chat-image-vision.mjs";

/** 本轮识图全部失败时，返回可展示给用户的提示 */
export function summarizeChatImageVisionErrors(
  vision: ChatImageVisionItem[] | undefined,
  neededVision: boolean,
): string | null {
  if (!neededVision || !vision?.length) return null;
  const failed = vision.filter((v) => !v.description);
  if (!failed.length) return null;
  const first = failed.find((v) => v.error)?.error;
  return first ? toUserFacingErrorMessage(first) : IMAGE_VISION_UNAVAILABLE;
}

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
