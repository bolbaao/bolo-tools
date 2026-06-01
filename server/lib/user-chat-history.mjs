import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { ensureUserMemoryDir } from "./user-auth.mjs";

const MAX_SESSIONS = 50;
const MAX_MESSAGES = 200;
const MAX_TITLE_LEN = 80;
const MAX_TEXT_LEN = 8000;

function historyPath(userId) {
  return path.join(ensureUserMemoryDir(userId), "chat-history.json");
}

function loadStore(userId) {
  const file = historyPath(userId);
  if (!fs.existsSync(file)) {
    return { activeSessionId: null, sessions: [] };
  }
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      activeSessionId: data.activeSessionId ?? null,
      sessions: Array.isArray(data.sessions) ? data.sessions : [],
    };
  } catch {
    return { activeSessionId: null, sessions: [] };
  }
}

function saveStore(userId, store) {
  fs.writeFileSync(historyPath(userId), JSON.stringify(store, null, 2));
}

function sanitizeMessage(msg) {
  if (!msg || typeof msg !== "object") return null;
  const role = msg.role === "user" ? "user" : msg.role === "ai" ? "ai" : null;
  if (!role) return null;
  const text = String(msg.text ?? "").trim().slice(0, MAX_TEXT_LEN);
  if (!text) return null;
  return {
    role,
    text,
    createdAt: msg.createdAt || new Date().toISOString(),
  };
}

function deriveTitle(messages) {
  const firstUser = messages.find((m) => m.role === "user" && m.text);
  if (!firstUser) return "新对话";
  const t = firstUser.text.replace(/\s+/g, " ").slice(0, MAX_TITLE_LEN);
  return t.length < firstUser.text.length ? `${t}…` : t;
}

export function listChatSessions(userId) {
  const store = loadStore(userId);
  return store.sessions
    .map(({ id, title, createdAt, updatedAt, messages }) => ({
      id,
      title,
      createdAt,
      updatedAt,
      messageCount: messages?.length ?? 0,
    }))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getChatSession(userId, sessionId) {
  const store = loadStore(userId);
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session) throw Object.assign(new Error("对话不存在"), { status: 404 });
  return session;
}

export function getActiveChatSession(userId) {
  const store = loadStore(userId);
  if (!store.activeSessionId) return null;
  return store.sessions.find((s) => s.id === store.activeSessionId) ?? null;
}

export function createChatSession(userId, title) {
  const store = loadStore(userId);
  if (store.sessions.length >= MAX_SESSIONS) {
    throw Object.assign(new Error(`最多保存 ${MAX_SESSIONS} 个对话`), { status: 400 });
  }
  const now = new Date().toISOString();
  const session = {
    id: randomUUID(),
    title: String(title ?? "新对话").trim().slice(0, MAX_TITLE_LEN) || "新对话",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  store.sessions.unshift(session);
  store.activeSessionId = session.id;
  saveStore(userId, store);
  return session;
}

export function setActiveChatSession(userId, sessionId) {
  const store = loadStore(userId);
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session) throw Object.assign(new Error("对话不存在"), { status: 404 });
  store.activeSessionId = sessionId;
  saveStore(userId, store);
  return session;
}

export function saveChatSessionMessages(userId, sessionId, messages) {
  const store = loadStore(userId);
  const idx = store.sessions.findIndex((s) => s.id === sessionId);
  if (idx < 0) throw Object.assign(new Error("对话不存在"), { status: 404 });

  const cleaned = (Array.isArray(messages) ? messages : [])
    .map(sanitizeMessage)
    .filter(Boolean)
    .slice(-MAX_MESSAGES);

  const now = new Date().toISOString();
  store.sessions[idx] = {
    ...store.sessions[idx],
    messages: cleaned,
    title: deriveTitle(cleaned),
    updatedAt: now,
  };
  store.activeSessionId = sessionId;
  saveStore(userId, store);
  return store.sessions[idx];
}

export function deleteChatSession(userId, sessionId) {
  const store = loadStore(userId);
  const next = store.sessions.filter((s) => s.id !== sessionId);
  if (next.length === store.sessions.length) {
    throw Object.assign(new Error("对话不存在"), { status: 404 });
  }
  store.sessions = next;
  if (store.activeSessionId === sessionId) {
    store.activeSessionId = next[0]?.id ?? null;
  }
  saveStore(userId, store);
  return store.activeSessionId;
}
