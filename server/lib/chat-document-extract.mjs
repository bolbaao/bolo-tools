import path from "path";
import { pathToFileURL } from "url";
import JSZip from "jszip";
import { HttpError } from "./http-error.mjs";
import { isLibreOfficeAvailable, libreConvert } from "./document-convert-local.mjs";

let pdfjsPromise;

async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
      const workerPath = path.join(
        process.cwd(),
        "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      );
      pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

async function extractPdfText(buffer) {
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  const parts = [];
  const maxPages = Math.min(doc.numPages, 30);
  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join(" ");
    if (text.trim()) parts.push(text.trim());
  }
  const full = parts.join("\n\n").replace(/\s+\n/g, "\n").trim();
  if (!full) throw new HttpError(422, "未能从 PDF 中提取文本（可能是扫描件）");
  return full.slice(0, 50000);
}

async function extractDocxText(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new HttpError(422, "无效的 Word 文档");
  const texts = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]);
  const full = texts.join("").replace(/\s+/g, " ").trim();
  if (!full) throw new HttpError(422, "Word 文档中没有可提取文本");
  return full.slice(0, 50000);
}

/**
 * @param {Buffer} buffer
 * @param {string} filename
 */
export async function extractDocumentText(buffer, filename) {
  if (!buffer?.length) throw new HttpError(400, "文件为空");

  const ext = path.extname(String(filename || "")).toLowerCase();
  if (ext === ".pdf") {
    return { content: await extractPdfText(buffer), kind: "pdf" };
  }
  if (ext === ".docx") {
    return { content: await extractDocxText(buffer), kind: "docx" };
  }
  if (ext === ".doc") {
    if (!isLibreOfficeAvailable()) {
      throw new HttpError(
        503,
        "暂不支持 .doc 格式，请另存为 .docx 后重试，或运行 ./scripts/download-libreoffice.sh",
      );
    }
    const docxBuf = await libreConvert(buffer, "docx", ".doc");
    return { content: await extractDocxText(Buffer.from(docxBuf)), kind: "doc" };
  }
  throw new HttpError(400, "不支持的文档格式");
}
