import { apiGet } from "@/lib/api";

export type ChatModelOption = {
  id: string;
  label: string;
  model: string;
};

export type ChatModelsResponse = {
  ok: boolean;
  models: ChatModelOption[];
  defaultProvider: string | null;
};

export const CHAT_PROVIDER_STORAGE_KEY = "pineapple-chat-provider";

export function readStoredChatProvider(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(CHAT_PROVIDER_STORAGE_KEY);
    return value?.trim() || null;
  } catch {
    return null;
  }
}

export function writeStoredChatProvider(provider: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CHAT_PROVIDER_STORAGE_KEY, provider);
  } catch {
    /* ignore */
  }
}

export function pickInitialChatProvider(
  models: ChatModelOption[],
  defaultProvider: string | null,
): string | null {
  if (!models.length) return null;
  const stored = readStoredChatProvider();
  if (stored && models.some((m) => m.id === stored)) return stored;
  if (defaultProvider && models.some((m) => m.id === defaultProvider)) return defaultProvider;
  return models[0].id;
}

export async function fetchChatModels(): Promise<ChatModelsResponse> {
  return apiGet<ChatModelsResponse>("/api/chat/models");
}

export function formatChatModelLabel(option: ChatModelOption): string {
  return option.label;
}
