import path from "path";
import { HttpError } from "./http-error.mjs";
import { extractDocumentText } from "./chat-document-extract.mjs";

export const MEMORY_FILE_ACCEPT = ".txt,.md,.json,.csv,.pdf,.doc,.docx";
export const MEMORY_FILE_MAX_BYTES = 5 * 1024 * 1024;
export const MEMORY_FILE_TEXT_MAX = 12000;

const TEXT_EXT = new Set([".txt", ".md", ".json", ".csv"]);

/**
 * @param {Buffer} buffer
 * @param {string} filename
 */
export async function extractMemoryFileText(buffer, filename) {
  if (!buffer?.length) throw new HttpError(400, "文件为空");
  if (buffer.length > MEMORY_FILE_MAX_BYTES) {
    throw new HttpError(400, `文件不能超过 ${Math.round(MEMORY_FILE_MAX_BYTES / 1024 / 1024)}MB`);
  }

  const ext = path.extname(String(filename || "")).toLowerCase();
  if (TEXT_EXT.has(ext)) {
    const raw = buffer.toString("utf8").replace(/^\uFEFF/, "").trim();
    if (!raw) throw new HttpError(422, "文件中没有可提取的文本");
    return {
      kind: ext.slice(1) || "text",
      content: raw.slice(0, MEMORY_FILE_TEXT_MAX),
      truncated: raw.length > MEMORY_FILE_TEXT_MAX,
    };
  }

  if ([".pdf", ".doc", ".docx"].includes(ext)) {
    const result = await extractDocumentText(buffer, filename);
    const content = String(result.content || "").trim();
    if (!content) throw new HttpError(422, "未能从文档中提取文本");
    return {
      kind: result.kind,
      content: content.slice(0, MEMORY_FILE_TEXT_MAX),
      truncated: content.length > MEMORY_FILE_TEXT_MAX,
    };
  }

  throw new HttpError(400, "不支持的文件格式，请上传 txt、md、pdf、doc、docx 等");
}
