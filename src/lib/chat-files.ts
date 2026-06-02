/** 对话附件：文本类文件（客户端读取内容发给模型） */
export type ChatTextFile = {
  name: string;
  size: number;
  mimeType: string;
  content: string;
};

export const CHAT_FILE_ACCEPT =
  "image/*,.txt,.md,.json,.csv,.log,.xml,.html,.css,.js,.ts,.tsx,.jsx,.mjs,.py,.yaml,.yml,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const MAX_TEXT_FILE_BYTES = 80_000;
export const MAX_DOCUMENT_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_TEXT_FILES_PER_SEND = 3;
export const MAX_EXTRACTED_TEXT_CHARS = 80_000;
export const MAX_PDF_PAGES = 60;

const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "json",
  "csv",
  "log",
  "xml",
  "html",
  "css",
  "js",
  "ts",
  "tsx",
  "jsx",
  "mjs",
  "py",
  "yaml",
  "yml",
]);

const DOCUMENT_EXTENSIONS = new Set(["pdf", "doc", "docx"]);

export function isImageChatFile(file: File): boolean {
  return file.type.startsWith("image/");
}

export function isTextChatFile(file: File): boolean {
  if (file.type.startsWith("text/")) return true;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext ? TEXT_EXTENSIONS.has(ext) : false;
}

export function isDocumentChatFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext && DOCUMENT_EXTENSIONS.has(ext)) return true;
  return (
    file.type === "application/pdf" ||
    file.type === "application/msword" ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

export function isReadableChatFile(file: File): boolean {
  return isTextChatFile(file) || isDocumentChatFile(file);
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractTextFromDocxXml(xml: string): string {
  const lines: string[] = [];
  for (const block of xml.split(/<w:p[\s>]/).slice(1)) {
    const segment = block.split("</w:p>")[0] ?? "";
    let line = "";
    const re = /<w:tab[^/]*\/>|<w:br[^/]*\/>|<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
    let match: RegExpExecArray | null;
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

function truncateExtracted(text: string): string {
  if (text.length <= MAX_EXTRACTED_TEXT_CHARS) return text;
  return `${text.slice(0, MAX_EXTRACTED_TEXT_CHARS)}\n\n（内容已截断，仅发送前 ${Math.round(MAX_EXTRACTED_TEXT_CHARS / 1024)}KB 文字）`;
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    useSystemFonts: true,
  }).promise;
  const pageCount = Math.min(doc.numPages, MAX_PDF_PAGES);
  const chunks: string[] = [];
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
    throw new Error(
      doc.numPages > pageCount
        ? `「${file.name}」前 ${pageCount} 页未识别到文字（可能为扫描件）`
        : `「${file.name}」未识别到可提取文字（可能为扫描件）`,
    );
  }
  if (doc.numPages > pageCount) {
    return `${text}\n\n（已读取前 ${pageCount} 页，共 ${doc.numPages} 页）`;
  }
  return text;
}

async function extractDocxText(file: File): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error(`无法读取 Word 文档：${file.name}`);
  const text = extractTextFromDocxXml(xml).trim();
  if (!text) throw new Error(`「${file.name}」中没有可提取的文字`);
  return text;
}

async function extractDocTextViaServer(file: File): Promise<ChatTextFile> {
  const { apiUpload } = await import("@/lib/api");
  const form = new FormData();
  form.append("file", file);
  const data = await apiUpload<{ ok: boolean; file: ChatTextFile }>(
    "/api/chat/extract-document",
    form,
    { timeoutMs: 120000 },
  );
  if (!data || typeof data !== "object" || !("file" in data) || !data.file) {
    throw new Error(`无法解析 Word 文档：${file.name}`);
  }
  return data.file;
}

export async function readTextChatFile(file: File): Promise<ChatTextFile> {
  if (isDocumentChatFile(file)) {
    return readDocumentChatFile(file);
  }
  if (!isTextChatFile(file)) {
    throw new Error(`不支持该文件类型：${file.name}`);
  }
  if (file.size > MAX_TEXT_FILE_BYTES) {
    throw new Error(`「${file.name}」超过 ${Math.round(MAX_TEXT_FILE_BYTES / 1024)}KB 上限`);
  }
  const content = await file.text();
  return {
    name: file.name,
    size: file.size,
    mimeType: file.type || "text/plain",
    content,
  };
}

export async function readDocumentChatFile(file: File): Promise<ChatTextFile> {
  if (!isDocumentChatFile(file)) {
    throw new Error(`不支持该文档类型：${file.name}`);
  }
  if (file.size > MAX_DOCUMENT_FILE_BYTES) {
    throw new Error(
      `「${file.name}」超过 ${Math.round(MAX_DOCUMENT_FILE_BYTES / (1024 * 1024))}MB 上限`,
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "doc") {
    return extractDocTextViaServer(file);
  }

  let content: string;
  if (ext === "pdf" || file.type === "application/pdf") {
    content = await extractPdfText(file);
  } else {
    content = await extractDocxText(file);
  }

  return {
    name: file.name,
    size: file.size,
    mimeType:
      file.type ||
      (ext === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    content: truncateExtracted(content),
  };
}

export function formatTextFilesForMessage(files: ChatTextFile[]): string {
  if (!files.length) return "";
  return files
    .map((f) => `[附件 ${f.name}]\n${f.content}`)
    .join("\n\n");
}

export function formatBytesShort(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
