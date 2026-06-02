import crypto from "crypto";

const TTL_MS = 60 * 60 * 1000;
/** @type {Map<string, { buffer: Buffer, filename: string, contentType: string, expiresAt: number }>} */
const store = new Map();

function purgeExpired() {
  const now = Date.now();
  for (const [id, item] of store) {
    if (item.expiresAt <= now) store.delete(id);
  }
}

export function putChatArtifact({ buffer, filename, contentType }) {
  purgeExpired();
  const id = crypto.randomBytes(12).toString("hex");
  store.set(id, {
    buffer: Buffer.from(buffer),
    filename: String(filename || "download").slice(0, 200),
    contentType: contentType || "application/octet-stream",
    expiresAt: Date.now() + TTL_MS,
  });
  return id;
}

export function getChatArtifact(id) {
  purgeExpired();
  const item = store.get(String(id || ""));
  if (!item || item.expiresAt <= Date.now()) {
    if (item) store.delete(id);
    return null;
  }
  return item;
}

export function chatArtifactUrl(id) {
  return `/api/chat/artifacts/${id}`;
}

export function formatArtifactLink(id, label) {
  return `[${label || "下载文件"}](${chatArtifactUrl(id)})`;
}
