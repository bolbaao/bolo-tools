export type OutputFormat = "JPG" | "PNG" | "WebP";

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    loadImageFromUrl(url, () => URL.revokeObjectURL(url))
      .then(resolve)
      .catch(reject);
  });
}

function loadImageFromUrl(src: string, onLoad?: () => void): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      onLoad?.();
      resolve(img);
    };
    img.onerror = () => {
      onLoad?.();
      reject(new Error("无法读取图片"));
    };
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("导出失败"));
      },
      mime,
      quality,
    );
  });
}

export type BackgroundSpec =
  | { type: "color"; color: string }
  | { type: "image"; source: File | string };

/** 将抠图结果（带透明通道）合成到新背景上 */
export async function compositeSubjectOnBackground(
  subjectBlob: Blob,
  background: BackgroundSpec,
): Promise<Blob> {
  const subjectUrl = URL.createObjectURL(subjectBlob);
  try {
    const subject = await loadImageFromUrl(subjectUrl, () => URL.revokeObjectURL(subjectUrl));
    const w = subject.naturalWidth;
    const h = subject.naturalHeight;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 不可用");

    if (background.type === "color") {
      ctx.fillStyle = background.color;
      ctx.fillRect(0, 0, w, h);
    } else {
      const bgImg =
        background.source instanceof File
          ? await loadImage(background.source)
          : await loadImageFromUrl(background.source);
      const scale = Math.max(w / bgImg.naturalWidth, h / bgImg.naturalHeight);
      const bw = bgImg.naturalWidth * scale;
      const bh = bgImg.naturalHeight * scale;
      const bx = (w - bw) / 2;
      const by = (h - bh) / 2;
      ctx.drawImage(bgImg, bx, by, bw, bh);
    }

    ctx.drawImage(subject, 0, 0);
    return canvasToBlob(canvas, "image/png");
  } catch (e) {
    URL.revokeObjectURL(subjectUrl);
    throw e;
  }
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

export async function buildImageZip(
  files: { blob: Blob; filename: string }[],
): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const used = new Set<string>();

  for (const { blob, filename } of files) {
    let name = filename;
    let n = 1;
    while (used.has(name)) {
      const dot = filename.lastIndexOf(".");
      const base = dot > 0 ? filename.slice(0, dot) : filename;
      const ext = dot > 0 ? filename.slice(dot) : "";
      name = `${base} (${n})${ext}`;
      n += 1;
    }
    used.add(name);
    zip.file(name, blob);
  }

  return zip.generateAsync({ type: "blob" });
}

/** 修图 API 上传上限（base64 字符数近似） */
const MAX_EDIT_DATA_URL_CHARS = 8_000_000;

/** 将图片转为 Seedream 修图 API 可接受的 JPEG Data URL */
export async function prepareImageForEdit(
  file: File,
  resolution: "1k" | "2k" = "2k",
): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("仅支持图片文件");

  const bitmap = await createImageBitmap(file);
  let width = bitmap.width;
  let height = bitmap.height;

  const maxDim = resolution === "1k" ? 1024 : 2048;
  if (Math.max(width, height) > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const ratio = width / height;
  if (ratio < 1 / 3 || ratio > 3) {
    bitmap.close?.();
    throw new Error("图片宽高比需在 1:3 至 3:1 之间");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    throw new Error("无法处理图片");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  let quality = 0.88;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length > MAX_EDIT_DATA_URL_CHARS && quality > 0.5) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  if (dataUrl.length > MAX_EDIT_DATA_URL_CHARS) {
    throw new Error("图片过大，请换一张较小的图片");
  }
  return dataUrl;
}
