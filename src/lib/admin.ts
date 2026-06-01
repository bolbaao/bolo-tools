import { apiGet } from "@/lib/api";

const cred = { credentials: "include" as const };

export type AdminUserSummary = {
  id: string;
  username: string;
  email?: string;
  emailVerified: boolean;
  isAdmin?: boolean;
  createdAt?: string;
  memoryCount: number;
  chatSessionCount: number;
};

export type AdminMemoryItem = {
  id: string;
  content: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminChatSessionSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

export type AdminChatMessage = {
  role: "user" | "ai";
  text: string;
  createdAt: string;
};

export type AdminChatSession = AdminChatSessionSummary & {
  messages: AdminChatMessage[];
};

export async function listAdminUsers() {
  const data = await apiGet<{ ok: boolean; users: AdminUserSummary[] }>("/api/admin/users", cred);
  return data.users;
}

export async function getAdminUserArchive(userId: string) {
  const data = await apiGet<{
    ok: boolean;
    user: AdminUserSummary;
    memories: AdminMemoryItem[];
    chatSessions: AdminChatSessionSummary[];
  }>(`/api/admin/users/${encodeURIComponent(userId)}/archive`, cred);
  return data;
}

export async function getAdminChatSession(userId: string, sessionId: string) {
  const data = await apiGet<{ ok: boolean; session: AdminChatSession }>(
    `/api/admin/users/${encodeURIComponent(userId)}/chat-history/${encodeURIComponent(sessionId)}`,
    cred,
  );
  return data.session;
}
