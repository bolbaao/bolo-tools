import { apiDelete, apiGet, apiPost, ApiError } from "@/lib/api";

export type ChatHistoryMessage = {
  role: "user" | "ai";
  text: string;
  createdAt?: string;
};

export type ChatSessionSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

export type ChatSession = ChatSessionSummary & {
  messages: ChatHistoryMessage[];
};

const cred = { credentials: "include" as const };

export async function listChatSessions() {
  const data = await apiGet<{
    ok: boolean;
    sessions: ChatSessionSummary[];
    activeSessionId: string | null;
  }>("/api/chat-history", cred);
  return data;
}

export async function getActiveChatSession() {
  const data = await apiGet<{ ok: boolean; session: ChatSession | null }>(
    "/api/chat-history/active",
    cred,
  );
  return data.session;
}

export async function createChatSession(title?: string) {
  const data = await apiPost<{ ok: boolean; session: ChatSession }>(
    "/api/chat-history",
    { title },
    cred,
  );
  return data.session;
}

export async function loadChatSession(id: string) {
  const data = await apiGet<{ ok: boolean; session: ChatSession }>(
    `/api/chat-history/${encodeURIComponent(id)}`,
    cred,
  );
  return data.session;
}

export async function saveChatSession(id: string, messages: ChatHistoryMessage[]) {
  const res = await fetch(`/api/chat-history/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
    credentials: "include",
  });
  const text = await res.text();
  let data: { ok?: boolean; error?: string; session?: ChatSession } = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      /* ignore */
    }
  }
  if (!res.ok || data.ok === false) {
    throw new ApiError(data.error || "保存对话失败", res.status);
  }
  return data.session!;
}

export async function deleteChatSession(id: string) {
  await apiDelete(`/api/chat-history/${encodeURIComponent(id)}`, cred);
}

export async function activateChatSession(id: string) {
  const data = await apiPost<{ ok: boolean; session: ChatSession }>(
    `/api/chat-history/${encodeURIComponent(id)}/activate`,
    {},
    cred,
  );
  return data.session;
}
