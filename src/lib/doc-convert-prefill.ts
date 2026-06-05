import type { DocConvertMode } from "@/lib/doc-convert";

/** 根据文件名推断文档转换模式 */
export function inferDocConvertModeFromFiles(files: File[]): DocConvertMode | null {
  if (!files.length) return null;
  const exts = files.map((f) => f.name.split(".").pop()?.toLowerCase() ?? "");
  const allImages = exts.every((e) => e === "png" || e === "jpg" || e === "jpeg");
  if (files.length > 1 && allImages) return "images-to-pdf";
  const ext = exts[0];
  if (ext === "pdf") return "pdf-to-word";
  if (ext === "doc" || ext === "docx") return "word-to-pdf";
  if (allImages) return "images-to-pdf";
  return null;
}
