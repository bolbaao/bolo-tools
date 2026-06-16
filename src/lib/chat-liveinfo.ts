export type ChatLiveInfoSource = {
  title: string;
  url: string;
};

export type ChatLiveInfoMeta = {
  label: string;
  value: string;
};

export type ChatLiveInfoCard = {
  kind: string;
  icon: string;
  title: string;
  headline: string;
  highlights: string[];
  fetchedAt?: string;
  sources?: ChatLiveInfoSource[];
  meta?: ChatLiveInfoMeta[];
};

const LIVEINFO_BLOCK_RE = /```liveinfo\s*([\s\S]*?)```/i;

export function parseChatLiveInfoCard(content: string): ChatLiveInfoCard | null {
  const match = String(content || "").match(LIVEINFO_BLOCK_RE);
  if (!match?.[1]) return null;
  try {
    const parsed = JSON.parse(match[1].trim()) as Partial<ChatLiveInfoCard>;
    if (!parsed.title || !parsed.headline) return null;
    return {
      kind: String(parsed.kind || "search"),
      icon: String(parsed.icon || "🔍"),
      title: String(parsed.title),
      headline: String(parsed.headline),
      highlights: Array.isArray(parsed.highlights)
        ? parsed.highlights.map((h) => String(h)).filter(Boolean).slice(0, 8)
        : [],
      fetchedAt: parsed.fetchedAt ? String(parsed.fetchedAt) : undefined,
      sources: Array.isArray(parsed.sources)
        ? parsed.sources
            .filter((s) => s && s.title && s.url)
            .map((s) => ({ title: String(s.title), url: String(s.url) }))
            .slice(0, 4)
        : [],
      meta: Array.isArray(parsed.meta)
        ? parsed.meta
            .filter((m) => m && m.label && m.value)
            .map((m) => ({ label: String(m.label), value: String(m.value) }))
        : [],
    };
  } catch {
    return null;
  }
}

export function stripChatLiveInfoBlock(content: string): string {
  return String(content || "")
    .replace(LIVEINFO_BLOCK_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatFetchedAt(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatLiveInfoUpdatedLabel(card: ChatLiveInfoCard): string {
  return formatFetchedAt(card.fetchedAt);
}

export function liveInfoKindClass(kind: string): string {
  const safe = String(kind || "search").replace(/[^a-z0-9-]/gi, "");
  return safe || "search";
}
