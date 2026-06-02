import { apiGet, apiPost } from "@/lib/api";

const cred = { credentials: "include" as const };

export type AdminUserSummary = {
  id: string;
  username: string;
  email?: string;
  emailVerified: boolean;
  isAdmin?: boolean;
  createdAt?: string;
  memoryCount: number;
};

export type AdminMemoryItem = {
  id: string;
  content: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminMediaItem = {
  id: string;
  userId: string | null;
  username: string;
  name: string;
  kind: "image" | "video";
  mime: string;
  size: number;
  source: string;
  uploadedAt: string;
  saved: boolean;
  expiresAt: string | null;
};

export async function getAdminDeveloperDocs() {
  const data = await apiGet<{ ok: boolean; content: string }>("/api/admin/developer-docs", cred);
  return data.content;
}

export async function listAdminUsers() {
  const data = await apiGet<{ ok: boolean; users: AdminUserSummary[] }>("/api/admin/users", cred);
  return data.users;
}

export async function getAdminUserArchive(userId: string) {
  const data = await apiGet<{
    ok: boolean;
    user: AdminUserSummary;
    memories: AdminMemoryItem[];
  }>(`/api/admin/users/${encodeURIComponent(userId)}/archive`, cred);
  return data;
}

export async function listAdminMedia(opts?: {
  userId?: string;
  kind?: "image" | "video";
  saved?: boolean;
}) {
  const params = new URLSearchParams();
  if (opts?.userId) params.set("userId", opts.userId);
  if (opts?.kind) params.set("kind", opts.kind);
  if (opts?.saved === true) params.set("saved", "1");
  if (opts?.saved === false) params.set("saved", "0");
  const qs = params.toString();
  const data = await apiGet<{ ok: boolean; items: AdminMediaItem[] }>(
    `/api/admin/media${qs ? `?${qs}` : ""}`,
    cred,
  );
  return data.items;
}

export async function setAdminMediaSaved(id: string, saved: boolean) {
  const data = await apiPost<{ ok: boolean; item: AdminMediaItem }>(
    `/api/admin/media/${encodeURIComponent(id)}/save`,
    { saved },
    cred,
  );
  return data.item;
}

export function adminMediaFileUrl(id: string) {
  return `/api/admin/media/${encodeURIComponent(id)}/file`;
}
