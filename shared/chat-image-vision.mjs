/** @param {{ previewDataUrl?: string; visionDescription?: string } | null | undefined} img */
export function imageNeedsVisionApi(img) {
  return Boolean(img?.previewDataUrl && !img?.visionDescription);
}

/** @param {{ clientPermissions?: { photos?: { status?: string; items?: unknown[] } }; chatImages?: unknown[] } | null | undefined} pageContext */
export function pageContextNeedsVisionApi(pageContext) {
  const photos = pageContext?.clientPermissions?.photos;
  if (photos?.status === "granted" && photos.items?.some(imageNeedsVisionApi)) {
    return true;
  }
  return Array.isArray(pageContext?.chatImages) && pageContext.chatImages.some(imageNeedsVisionApi);
}
