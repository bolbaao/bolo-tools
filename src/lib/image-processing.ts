export type OutputFormat = "JPG" | "PNG" | "WebP";

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法读取图片"));
    };
    img.src = url;
  });
}

function mimeForFormat(format: OutputFormat): string {
  if (format === "JPG") return "image/jpeg";
  if (format === "PNG") return "image/png";
  return "image/webp";
}

function extForFormat(format: OutputFormat): string {
  return format.toLowerCase() === "jpg" ? "jpg" : format.toLowerCase();
}

export async function compressImage(
  file: File,
  format: OutputFormat,
  quality: number,
): Promise<Blob> {
  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 不可用");
  ctx.drawImage(img, 0, 0);

  const mime = mimeForFormat(format);
  const q = Math.min(0.95, Math.max(0.3, quality / 100));

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("压缩失败"));
      },
      mime,
      format === "PNG" ? undefined : q,
    );
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function outputFilename(originalName: string, format: OutputFormat): string {
  const base = originalName.replace(/\.[^.]+$/, "") || "image";
  return `${base}-compressed.${extForFormat(format)}`;
}

type SharpenLevel = "light" | "standard" | "strong";

const SHARPEN_AMOUNT: Record<SharpenLevel, number> = {
  light: 0.35,
  standard: 0.65,
  strong: 1.0,
};

/** Unsharp mask 风格锐化 */
export async function sharpenImage(file: File, level: SharpenLevel): Promise<Blob> {
  const img = await loadImage(file);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 不可用");

  ctx.drawImage(img, 0, 0);
  const original = ctx.getImageData(0, 0, w, h);

  const blurCanvas = document.createElement("canvas");
  blurCanvas.width = w;
  blurCanvas.height = h;
  const blurCtx = blurCanvas.getContext("2d")!;
  blurCtx.filter = "blur(2px)";
  blurCtx.drawImage(img, 0, 0);
  const blurred = blurCtx.getImageData(0, 0, w, h);

  const amount = SHARPEN_AMOUNT[level];
  const out = ctx.createImageData(w, h);
  for (let i = 0; i < original.data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const o = original.data[i + c];
      const b = blurred.data[i + c];
      const v = o + (o - b) * amount;
      out.data[i + c] = Math.min(255, Math.max(0, Math.round(v)));
    }
    out.data[i + 3] = original.data[i + 3];
  }
  ctx.putImageData(out, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("处理失败"));
      },
      file.type.startsWith("image/") ? file.type : "image/png",
      0.92,
    );
  });
}

export function previewUrlFromFile(file: File): string {
  return URL.createObjectURL(file);
}
