import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import { classifyChatFile } from "./chat-file-types.mjs";
import { getUserById } from "./user-auth.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEDIA_DIR = path.join(__dirname, "..", "..", "data", "user-media");
const FILES_DIR = path.join(MEDIA_DIR, "files");
const META_PATH = path.join(MEDIA_DIR, "meta.json");

const RETENTION_MS = 2 * 24 * 60 * 60 * 1000;

function ensureDirs() {
  if (!fs.existsSync(FILES_DIR)) {
    fs.mkdirSync(FILES_DIR, { recursive: true });
  }
}

function loadMeta() {
  ensureDirs();
  if (!fs.existsSync(META_PATH)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(META_PATH, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveMeta(items) {
  ensureDirs();
  fs.writeFileSync(META_PATH, JSON.stringify(items, null, 2));
}

function extFromMime(mime, fallback = "") {
  const map = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
  };
  return map[mime] || fallback || "";
}

function fileKind(mime, name) {
  const kind = classifyChatFile(name, mime);
  if (kind === "image" || kind === "video") return kind;
  return null;
}

function resolveFileBuffer(file) {
  if (file?.buffer?.length) return file.buffer;
  if (file?.path && fs.existsSync(file.path)) {
    return fs.readFileSync(file.path);
  }
  return null;
}

function toPublicItem(item) {
  const user = item.userId ? getUserById(item.userId) : null;
  const expiresAt = item.saved ? null : new Date(new Date(item.uploadedAt).getTime() + RETENTION_MS).toISOString();
  return {
    id: item.id,
    userId: item.userId || null,
    username: user?.username || item.username || (item.userId ? "—" : "未登录"),
    name: item.name,
    kind: item.kind,
    mime: item.mime,
    size: item.size,
    source: item.source || "unknown",
    uploadedAt: item.uploadedAt,
    saved: Boolean(item.saved),
    expiresAt,
  };
}

/**
 * @param {string | null | undefined} userId
 * @param {{ originalname?: string, mimetype?: string, size?: number, buffer?: Buffer, path?: string }} file
 * @param {string} [source]
 */
export function recordUserMediaUpload(userId, file, source = "unknown") {
  if (!file) return null;

  const name = String(file.originalname || "file").slice(0, 200);
  const mime = String(file.mimetype || "application/octet-stream");
  const kind = fileKind(mime, name);
  if (!kind) return null;

  const buffer = resolveFileBuffer(file);
  if (!buffer?.length) return null;

  ensureDirs();
  const ext = path.extname(name) || extFromMime(mime, kind === "video" ? ".mp4" : ".jpg");
  const storedName = `${randomUUID()}${ext}`;
  const storedPath = path.join(FILES_DIR, storedName);
  fs.writeFileSync(storedPath, buffer);

  const user = userId ? getUserById(userId) : null;
  const item = {
    id: randomUUID(),
    userId: userId || null,
    username: user?.username || (userId ? "" : "未登录"),
    name,
    storedName,
    mime,
    kind,
    size: file.size ?? buffer.length,
    source,
    uploadedAt: new Date().toISOString(),
    saved: false,
  };

  const meta = loadMeta();
  meta.push(item);
  saveMeta(meta);
  return item;
}

/** @param {string | null | undefined} userId @param {unknown} files @param {string} [source] */
export function recordUserMediaUploads(userId, files, source = "unknown") {
  const list = Array.isArray(files) ? files : files ? [files] : [];
  for (const file of list) {
    try {
      recordUserMediaUpload(userId || null, file, source);
    } catch (err) {
      console.warn(`[user-media] 记录上传失败: ${err.message}`);
    }
  }
}

export function listAllUserMedia({ userId, kind, saved } = {}) {
  let items = loadMeta();
  if (userId === "__anonymous__") items = items.filter((i) => !i.userId);
  else if (userId) items = items.filter((i) => i.userId === userId);
  if (kind === "image" || kind === "video") items = items.filter((i) => i.kind === kind);
  if (saved === true) items = items.filter((i) => i.saved);
  if (saved === false) items = items.filter((i) => !i.saved);
  items.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  return items.map(toPublicItem);
}

export function setUserMediaSaved(id, saved) {
  const meta = loadMeta();
  const idx = meta.findIndex((i) => i.id === id);
  if (idx < 0) {
    const err = new Error("媒体不存在");
    err.status = 404;
    throw err;
  }
  meta[idx].saved = Boolean(saved);
  if (saved) {
    meta[idx].savedAt = new Date().toISOString();
  } else {
    delete meta[idx].savedAt;
  }
  saveMeta(meta);
  return toPublicItem(meta[idx]);
}

export function getUserMediaFile(id) {
  const item = loadMeta().find((i) => i.id === id);
  if (!item) return null;
  const filePath = path.join(FILES_DIR, path.basename(item.storedName));
  if (!filePath.startsWith(FILES_DIR) || !fs.existsSync(filePath)) return null;
  return { item, filePath };
}

/** 取最近一次对话上传的音视频（多轮对话复用附件） */
export function getLatestChatUpload(userId, kinds = ["video", "audio"]) {
  const kindSet = new Set(kinds);
  let items = loadMeta().filter(
    (i) => i.source === "chat" && (i.kind === "video" || i.kind === "audio"),
  );
  if (userId) items = items.filter((i) => i.userId === userId);
  else items = items.filter((i) => !i.userId);
  items.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

  for (const item of items) {
    if (!kindSet.has(item.kind)) continue;
    const stored = getUserMediaFile(item.id);
    if (!stored) continue;
    const buffer = fs.readFileSync(stored.filePath);
    if (!buffer?.length) continue;
    return {
      buffer,
      originalname: item.name,
      mimetype: item.mime,
      size: item.size ?? buffer.length,
    };
  }
  return null;
}

export function cleanupExpiredUserMedia() {
  const now = Date.now();
  const meta = loadMeta();
  const kept = [];
  let removed = 0;

  for (const item of meta) {
    if (item.saved) {
      kept.push(item);
      continue;
    }
    const age = now - new Date(item.uploadedAt).getTime();
    if (age < RETENTION_MS) {
      kept.push(item);
      continue;
    }
    const filePath = path.join(FILES_DIR, path.basename(item.storedName));
    if (filePath.startsWith(FILES_DIR) && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    removed += 1;
  }

  if (removed > 0) {
    saveMeta(kept);
    console.log(`[user-media] 已清理 ${removed} 个过期媒体文件`);
  }
  return removed;
}

export function startUserMediaCleanupInterval() {
  cleanupExpiredUserMedia();
  const intervalMs = 60 * 60 * 1000;
  return setInterval(() => {
    try {
      cleanupExpiredUserMedia();
    } catch (err) {
      console.warn(`[user-media] 自动清理失败: ${err.message}`);
    }
  }, intervalMs);
}
