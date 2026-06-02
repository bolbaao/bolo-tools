import JSZip from "jszip";
import path from "path";
import { fileURLToPath } from "url";
import { HttpError } from "./http-error.mjs";
import { isLibreOfficeAvailable, libreConvert } from "./document-convert-local.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let pdfjsServerReady = false;

async function loadPdfjsServer() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (!pdfjsServerReady) {
    pdfjs.GlobalWorkerOptions.workerSrc = path.join(
      __dirname,
      "../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    );
    pdfjsServerReady = true;
  }
  return pdfjs;
}

const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 80_000;
const MAX_PDF_PAGES = 60;

function extOf(name) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function decodeXmlEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractTextFromDocxXml(xml) {
  const lines = [];
  for (const block of xml.split(/<w:p[\s>]/).slice(1)) {
    const segment = block.split("</w:p>")[0] ?? "";
    let line = "";
    const re = /<w:tab[^/]*\/>|<w:br[^/]*\/>|<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
    let match;
    while ((match = re.exec(segment))) {
      const token = match[0];
      if (token.includes("w:tab")) line += "\t";
      else if (token.includes("w:br")) line += "\n";
      else if (match[1] !== undefined) line += decodeXmlEntities(match[1]);
    }
    if (line.trim()) lines.push(line);
  }
  return lines.join("\n");
}

async function extractDocxText(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new HttpError(422, "无法读取 Word 文档内容");
  const text = extractTextFromDocxXml(xml).trim();
  if (!text) throw new HttpError(422, "Word 文档中没有可提取的文字");
  return text;
}

async function extractPdfText(buffer) {
  const pdfjs = await loadPdfjsServer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  const pageCount = Math.min(doc.numPages, MAX_PDF_PAGES);
  const chunks = [];
  for (let i = 1; i <= pageCount; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item && typeof item.str === "string" ? item.str : ""))
      .join("");
    if (pageText.trim()) chunks.push(pageText);
  }
  const text = chunks.join("\n\n").trim();
  if (!text) {
    throw new HttpError(
      422,
      doc.numPages > pageCount
        ? `PDF 前 ${pageCount} 页未识别到文字（可能为扫描件）`
        : "PDF 中未识别到可提取文字（可能为扫描件）",
    );
  }
  if (doc.numPages > pageCount) {
    return `${text}\n\n（已读取前 ${pageCount} 页，共 ${doc.numPages} 页）`;
  }
  return text;
}

async function extractDocText(buffer) {
  if (!isLibreOfficeAvailable()) {
    throw new HttpError(
      503,
      "暂不支持 .doc 格式。请另存为 .docx，或使用文档转换工具转为 PDF / Word 2007+",
    );
  }
  const txtBuffer = await libreConvert(buffer, "txt", ".doc");
  const text = Buffer.from(txtBuffer).toString("utf8").replace(/\u0000/g, "").trim();
  if (!text) throw new HttpError(422, "Word 文档中没有可提取的文字");
  return text;
}

function truncateExtracted(text) {
  if (text.length <= MAX_EXTRACTED_CHARS) return text;
  return `${text.slice(0, MAX_EXTRACTED_CHARS)}\n\n（内容已截断，仅发送前 ${Math.round(MAX_EXTRACTED_CHARS / 1024)}KB 文字）`;
}

export async function extractDocumentText(buffer, originalName) {
  if (!buffer?.length) throw new HttpError(400, "文件为空");
  if (buffer.length > MAX_DOCUMENT_BYTES) {
    throw new HttpError(413, `文件不能超过 ${Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024))}MB`);
  }

  const ext = extOf(originalName || "");
  let text;
  if (ext === ".pdf") {
    text = await extractPdfText(buffer);
  } else if (ext === ".docx") {
    text = await extractDocxText(buffer);
  } else if (ext === ".doc") {
    text = await extractDocText(buffer);
  } else {
    throw new HttpError(400, "不支持的文档类型");
  }

  return {
    name: originalName || "document",
    size: buffer.length,
    mimeType:
      ext === ".pdf"
        ? "application/pdf"
        : ext === ".docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/msword",
    content: truncateExtracted(text),
  };
}
