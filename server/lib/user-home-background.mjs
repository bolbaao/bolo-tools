import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { HttpError } from "./http-error.mjs";
import { ensureUserMemoryDir } from "./user-auth.mjs";

const META_NAME = "home-background.json";
const MAX_BYTES = 50 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

const EXT_BY_MIME = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

function metaPath(userId) {
  return path.join(ensureUserMemoryDir(userId), META_NAME);
}

function loadMeta(userId) {
  const file = metaPath(userId);
  if (!fs.existsSync(file)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

function saveMeta(userId, meta) {
  fs.writeFileSync(metaPath(userId), JSON.stringify(meta, null, 2));
}

function listBackgroundFiles(userId) {
  const dir = ensureUserMemoryDir(userId);
  return fs.readdirSync(dir).filter((name) => name.startsWith("home-background."));
}

function removeBackgroundFiles(userId) {
  for (const name of listBackgroundFiles(userId)) {
    const filePath = path.join(ensureUserMemoryDir(userId), name);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  const meta = metaPath(userId);
  if (fs.existsSync(meta)) fs.unlinkSync(meta);
}

export function getHomeBackgroundInfo(userId) {
  const meta = loadMeta(userId);
  if (!meta?.storedName) return { configured: false };
  const filePath = path.join(ensureUserMemoryDir(userId), meta.storedName);
  if (!fs.existsSync(filePath)) {
    removeBackgroundFiles(userId);
    return { configured: false };
  }
  return {
    configured: true,
    name: meta.originalName || meta.storedName,
    mime: meta.mime || "video/mp4",
    size: meta.size ?? fs.statSync(filePath).size,
    updatedAt: meta.updatedAt,
  };
}

export function getHomeBackgroundFile(userId) {
  const meta = loadMeta(userId);
  if (!meta?.storedName) return null;
  const dir = ensureUserMemoryDir(userId);
  const filePath = path.join(dir, meta.storedName);
  if (!filePath.startsWith(dir) || !fs.existsSync(filePath)) return null;
  return { filePath, mime: meta.mime || "video/mp4", name: meta.originalName };
}

export function saveHomeBackground(userId, file) {
  if (!file) throw new HttpError(400, "请选择视频文件");
  if (!ALLOWED_MIME.has(file.mimetype)) {
    throw new HttpError(400, "仅支持 MP4、WebM 或 MOV 格式");
  }
  if (file.size > MAX_BYTES) {
    throw new HttpError(400, `视频不能超过 ${Math.round(MAX_BYTES / 1024 / 1024)}MB`);
  }

  removeBackgroundFiles(userId);
  const ext = EXT_BY_MIME[file.mimetype] || path.extname(file.originalname) || ".mp4";
  const storedName = `home-background.${randomUUID()}${ext}`;
  const dest = path.join(ensureUserMemoryDir(userId), storedName);
  fs.renameSync(file.path, dest);

  const meta = {
    storedName,
    originalName: file.originalname || storedName,
    mime: file.mimetype,
    size: file.size,
    updatedAt: new Date().toISOString(),
  };
  saveMeta(userId, meta);
  return getHomeBackgroundInfo(userId);
}

export function clearHomeBackground(userId) {
  const had = Boolean(loadMeta(userId));
  removeBackgroundFiles(userId);
  return { cleared: had };
}
