import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { ensureUserMemoryDir } from "./user-auth.mjs";

const MAX_MEMORIES = 200;
const MAX_CONTENT_LEN = 2000;

function memoryPath(userId) {
  return path.join(ensureUserMemoryDir(userId), "memories.json");
}

function loadMemories(userId) {
  const file = memoryPath(userId);
  if (!fs.existsSync(file)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveMemories(userId, items) {
  fs.writeFileSync(memoryPath(userId), JSON.stringify(items, null, 2));
}

export function listUserMemories(userId) {
  return loadMemories(userId).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function formatMemoriesForPrompt(userId, limit = 20) {
  const items = listUserMemories(userId).slice(0, limit);
  if (!items.length) return "";
  const lines = items.map((m, i) => `${i + 1}. ${m.content}`);
  return `以下是该用户此前保存的个人记忆，请在回复中自然参考（勿逐条复述）：\n${lines.join("\n")}`;
}

export function addUserMemory(userId, content, source = "manual") {
  const text = String(content ?? "").trim();
  if (!text) throw Object.assign(new Error("记忆内容不能为空"), { status: 400 });
  if (text.length > MAX_CONTENT_LEN) {
    throw Object.assign(new Error(`记忆内容不能超过 ${MAX_CONTENT_LEN} 字`), { status: 400 });
  }

  const normalizedSource = source === "auto" || source === "file" ? source : "manual";

  const items = loadMemories(userId);
  if (items.length >= MAX_MEMORIES) {
    throw Object.assign(new Error(`记忆库已满（最多 ${MAX_MEMORIES} 条）`), { status: 400 });
  }

  const now = new Date().toISOString();
  const item = {
    id: randomUUID(),
    content: text,
    source: normalizedSource,
    createdAt: now,
    updatedAt: now,
  };
  items.push(item);
  saveMemories(userId, items);
  return item;
}

export function addUserMemoryAuto(userId, content) {
  return addUserMemory(userId, content, "auto");
}

export function addUserMemoryFromFile(userId, content) {
  return addUserMemory(userId, content, "file");
}

export function updateUserMemory(userId, memoryId, content) {
  const text = String(content ?? "").trim();
  if (!text) throw Object.assign(new Error("记忆内容不能为空"), { status: 400 });
  if (text.length > MAX_CONTENT_LEN) {
    throw Object.assign(new Error(`记忆内容不能超过 ${MAX_CONTENT_LEN} 字`), { status: 400 });
  }

  const items = loadMemories(userId);
  const idx = items.findIndex((m) => m.id === memoryId);
  if (idx < 0) throw Object.assign(new Error("记忆不存在"), { status: 404 });

  items[idx] = {
    ...items[idx],
    content: text,
    updatedAt: new Date().toISOString(),
  };
  saveMemories(userId, items);
  return items[idx];
}

export function deleteUserMemory(userId, memoryId) {
  const items = loadMemories(userId);
  const next = items.filter((m) => m.id !== memoryId);
  if (next.length === items.length) {
    throw Object.assign(new Error("记忆不存在"), { status: 404 });
  }
  saveMemories(userId, next);
}
