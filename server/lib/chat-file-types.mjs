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
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "mkv", "webm", "avi", "m4v"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "aac", "ogg", "flac", "wma"]);

function extOf(name) {
  const i = String(name || "").lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function classifyChatFile(name, mimeType = "") {
  const mime = String(mimeType || "").toLowerCase();
  const ext = extOf(name);

  // 扩展名优先：浏览器常把 PDF/Word 误报为 image/* 或 application/octet-stream
  if (DOCUMENT_EXTENSIONS.has(ext)) return "document";
  if (
    mime === "application/pdf" ||
    mime === "application/msword" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    (ext === "docx" &&
      (mime === "application/zip" || mime === "application/x-zip-compressed"))
  ) {
    return "document";
  }

  if (mime.startsWith("text/") || TEXT_EXTENSIONS.has(ext)) return "text";

  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/") || VIDEO_EXTENSIONS.has(ext)) return "video";
  if (mime.startsWith("audio/") || AUDIO_EXTENSIONS.has(ext)) return "audio";

  return "unknown";
}

export function isReadableChatFile(name, mimeType = "") {
  const kind = classifyChatFile(name, mimeType);
  return kind === "text" || kind === "document";
}

export const CHAT_UPLOAD_LIMITS = {
  maxFiles: 6,
  maxImageBytes: 8 * 1024 * 1024,
  maxDocumentBytes: 15 * 1024 * 1024,
  maxAudioBytes: 25 * 1024 * 1024,
  maxVideoBytes: 80 * 1024 * 1024,
  maxTextBytes: 2 * 1024 * 1024,
};

export function maxBytesForKind(kind) {
  if (kind === "image") return CHAT_UPLOAD_LIMITS.maxImageBytes;
  if (kind === "document") return CHAT_UPLOAD_LIMITS.maxDocumentBytes;
  if (kind === "audio") return CHAT_UPLOAD_LIMITS.maxAudioBytes;
  if (kind === "video") return CHAT_UPLOAD_LIMITS.maxVideoBytes;
  if (kind === "text") return CHAT_UPLOAD_LIMITS.maxTextBytes;
  return 2 * 1024 * 1024;
}
