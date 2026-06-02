/** 浏览器端 PDF.js：Next 静态导出需显式指定 worker，不能用 webpack.mjs 的 Worker URL */
let pdfjsModule: typeof import("pdfjs-dist/legacy/build/pdf.mjs") | null = null;

function workerUrl(): string {
  if (typeof window === "undefined") return "/static/pdf.worker.min.mjs";
  return `${window.location.origin}/static/pdf.worker.min.mjs`;
}

export async function loadPdfjsClient() {
  const pdfjs = pdfjsModule ?? (await import("pdfjs-dist/legacy/build/pdf.mjs"));
  if (typeof window !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerPort = null;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl();
  }
  pdfjsModule = pdfjs;
  return pdfjs;
}
