import { apiDelete, apiGet, apiPost, ApiError, apiUpload } from "@/lib/api";

export type MemoryItem = {
  id: string;
  content: string;
  source?: "manual" | "auto" | "file";
  createdAt: string;
  updatedAt: string;
};

export type MemoryFileExtractResult = {
  added: MemoryItem[];
  meta: {
    filename: string;
    kind: string;
    truncated: boolean;
  };
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

export async function extractMemoriesFromFile(file: File) {
  const form = new FormData();
  form.append("file", file, file.name);
  const raw = await apiUpload("/api/memory/extract-file", form, {
    credentials: "include",
    timeoutMs: 120000,
  });
  if (raw instanceof Blob) {
    throw new ApiError("服务返回异常");
  }
  const data = raw as { ok: boolean; added: MemoryItem[]; meta: MemoryFileExtractResult["meta"] };
  return { added: data.added, meta: data.meta };
}
