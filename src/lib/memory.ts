import { apiDelete, apiGet, apiPost, ApiError } from "@/lib/api";

export type MemoryItem = {
  id: string;
  content: string;
  source?: "manual" | "auto";
  createdAt: string;
  updatedAt: string;
};

const cred = { credentials: "include" as const };

export async function listMemories() {
  const data = await apiGet<{ ok: boolean; items: MemoryItem[] }>("/api/memory", cred);
  return data.items;
}

export async function addMemory(content: string) {
  const data = await apiPost<{ ok: boolean; item: MemoryItem }>(
    "/api/memory",
    { content },
    cred,
  );
  return data.item;
}

export async function extractMemoriesAuto(userMessage: string, assistantReply: string) {
  const data = await apiPost<{ ok: boolean; added: MemoryItem[] }>(
    "/api/memory/extract-auto",
    { userMessage, assistantReply },
    cred,
  );
  return data.added;
}

export async function updateMemory(id: string, content: string) {
  const res = await fetch(`/api/memory/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
    credentials: "include",
  });
  const text = await res.text();
  let data: { ok?: boolean; error?: string; item?: MemoryItem } = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      /* ignore */
    }
  }
  if (!res.ok || data.ok === false) {
    throw new ApiError(data.error || "更新失败", res.status);
  }
  return data.item!;
}

export async function deleteMemory(id: string) {
  await apiDelete(`/api/memory/${encodeURIComponent(id)}`, cred);
}
