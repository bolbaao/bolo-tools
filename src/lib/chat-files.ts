export type ChatFileKind = "image" | "video" | "audio" | "document" | "text" | "unknown";

import type { ChatLiveInfoCard } from "@/lib/chat-liveinfo";
import { parseChatLiveInfoCard, stripChatLiveInfoBlock } from "@/lib/chat-liveinfo";
import type { ChatWeatherCard } from "@/lib/chat-weather";
import { parseChatWeatherCard, stripChatWeatherBlock } from "@/lib/chat-weather";

const ACCEPT = [
  "image/*",
  "video/*",
  "audio/*",
  ".pdf",
  ".doc",
  ".docx",
  ".txt",
  ".md",
  ".json",
  ".csv",
].join(",");

export const CHAT_FILE_ACCEPT = ACCEPT;
export const CHAT_MAX_FILES = 6;

export function chatFileKindLabel(kind: ChatFileKind): string {
  if (kind === "image") return "图片";
  if (kind === "video") return "视频";
  if (kind === "audio") return "音频";
  if (kind === "document") return "文档";
  if (kind === "text") return "文本";
  return "文件";
}

export function chatFileKindFromName(name: string, mimeType = ""): ChatFileKind {
  const mime = mimeType.toLowerCase();
  const ext = name.split(".").pop()?.toLowerCase() || "";

  if (["pdf", "doc", "docx"].includes(ext)) return "document";
  if (
    mime === "application/pdf" ||
    mime === "application/msword" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    (ext === "docx" && (mime === "application/zip" || mime === "application/x-zip-compressed"))
  ) {
    return "document";
  }

  if (mime.startsWith("text/") || ["txt", "md", "json", "csv"].includes(ext)) return "text";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "unknown";
}

export type PendingChatFile = {
  id: string;
  file: File;
  kind: ChatFileKind;
  previewUrl?: string;
};

export async function pendingFileFromFile(file: File): Promise<PendingChatFile> {
  const kind = chatFileKindFromName(file.name, file.type);
  let previewUrl: string | undefined;
  if (kind === "image") {
    previewUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("读取图片失败"));
      reader.readAsDataURL(file);
    });
  } else if (kind === "video") {
    previewUrl = URL.createObjectURL(file);
  }
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    kind,
    previewUrl,
  };
}

export type ProcessedChatFile = {
  kind: ChatFileKind;
  name: string;
  mimeType?: string;
  description?: string | null;
  transcript?: string | null;
  content?: string | null;
  metadata?: string | null;
  error?: string | null;
  previewDataUrl?: string;
};

export type AgentAction = {
  toolId: string;
  title: string;
  href: string;
  fields: Record<string, string>;
  summary?: string;
};

export type ChatMessageAttachment = {
  id: string;
  name: string;
  kind: ChatFileKind;
  previewUrl?: string;
  size?: number;
};

export type ChatArtifactDownload = {
  id: string;
  label: string;
  href: string;
};

export type ChatReplyImage = {
  id: string;
  alt: string;
  href: string;
};

const ATTACHMENT_NOTE_RE = /\n\[已附加 \d+ 个文件\]$/;

export function stripChatAttachmentNote(content: string): string {
  return content.replace(ATTACHMENT_NOTE_RE, "").trim();
}

function normalizeArtifactHref(href: string): string {
  return href.split("?")[0];
}

export function extractChatReplyMedia(content: string): {
  text: string;
  images: ChatReplyImage[];
  downloads: ChatArtifactDownload[];
  weather: ChatWeatherCard | null;
  liveInfo: ChatLiveInfoCard | null;
} {
  const weather = parseChatWeatherCard(content);
  const liveInfo = parseChatLiveInfoCard(content);
  let source = content;
  if (weather) source = stripChatWeatherBlock(source);
  if (liveInfo) source = stripChatLiveInfoBlock(source);
  const images: ChatReplyImage[] = [];
  const downloads: ChatArtifactDownload[] = [];
  const seen = new Set<string>();

  const ingest = (id: string, href: string, label: string, asImage: boolean) => {
    if (seen.has(id)) return;
    seen.add(id);
    const normalized = normalizeArtifactHref(href);
    if (asImage) {
      images.push({ id, alt: label, href: normalized });
      return;
    }
    downloads.push({ id, label, href: normalized });
  };

  let text = source;

  const imgMdRe = /!\[([^\]]*)\]\((\/api\/chat\/artifacts\/([a-f0-9]+)(?:\?[^)]*)?)\)/gi;
  text = text.replace(imgMdRe, (_match, alt, href, id) => {
    ingest(id, href, String(alt || "").trim() || "图片", true);
    return "";
  });

  const linkRe = /\[([^\]]+)\]\((\/api\/chat\/artifacts\/([a-f0-9]+)(?:\?[^)]*)?)\)/gi;
  text = text.replace(linkRe, (_match, label, href, id) => {
    const trimmed = String(label || "").trim();
    ingest(id, href, trimmed || "文件", chatArtifactKindFromLabel(trimmed) === "image");
    return "";
  });

  text = text
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text, images, downloads, weather, liveInfo };
}

/** @deprecated 使用 extractChatReplyMedia */
export function extractChatArtifactDownloads(content: string): {
  text: string;
  downloads: ChatArtifactDownload[];
} {
  const { text, downloads, images } = extractChatReplyMedia(content);
  return {
    text,
    downloads: [
      ...images.map((img) => ({ id: img.id, label: img.alt, href: img.href })),
      ...downloads,
    ],
  };
}

/** 从「下载 xxx.pptx」类标签提取建议文件名 */
export function artifactDownloadName(label: string): string | undefined {
  const trimmed = String(label || "")
    .replace(/^下载\s*/i, "")
    .trim();
  if (/\.[a-z0-9]{2,5}$/i.test(trimmed)) return trimmed;
  return undefined;
}

export function chatArtifactKindFromLabel(label: string): ChatFileKind {
  const s = label.toLowerCase();
  if (/\.(png|jpe?g|webp|gif|bmp|svg)|图片|image/.test(s)) return "image";
  if (/\.(mp4|mov|webm|mkv)|视频|video/.test(s)) return "video";
  if (/\.(mp3|wav|flac|aac|ogg|m4a)|音频|audio/.test(s)) return "audio";
  if (/\.(pdf|docx?|pptx?|xlsx?)|文档|pdf|word|ppt|幻灯|演示/.test(s)) return "document";
  if (/\.(html?|htm)|应用|html/.test(s)) return "text";
  if (/\.(gif)|动图/.test(s)) return "image";
  return "unknown";
}

export function chatFileKindIcon(kind: ChatFileKind): string {
  if (kind === "image") return "🖼";
  if (kind === "video") return "▶";
  if (kind === "audio") return "♪";
  if (kind === "document") return "📄";
  if (kind === "text") return "📝";
  return "📎";
}
