import { formatHeat } from "./trends-fetch.mjs";
import { liveInfoKindMeta } from "./live-info-detect.mjs";

const LIVEINFO_BLOCK = "liveinfo";

function formatFetchedAt(iso) {
  const d = new Date(iso || Date.now());
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stripReferenceSection(text) {
  return String(text || "")
    .replace(/\n\*{0,2}参考来源\*{0,2}[\s\S]*$/i, "")
    .trim();
}

/** 去掉正文里的元信息脚注、引用编号与主动推销下载/观看链接的句子 */
export function sanitizeLiveInfoSummary(text) {
  return String(text || "")
    .replace(/_?\s*更新于\s+[\d/月日:\s]+\s*·\s*基于实时检索[^_\n]*_?/gi, "")
    .replace(/_?\s*更新于\s+[\d/月日:\s]+\s*·\s*实时榜单_?/gi, "")
    .replace(/_?\s*更新于\s+[\d/月日:\s]+\s*·\s*未参考历史对话_?/gi, "")
    .replace(/\n+(?:需要|要不要|是否|想不想).{0,24}(?:下载链接|观看链接|播放链接|网盘|资源链接)[^\n?？]*[?？]?/gi, "")
    .replace(/\n+(?:如果你需要|如需|若需要|要不要我).{0,32}(?:下载|观看|播放|网盘|资源)[^\n?？]*[?？]?/gi, "")
    .replace(/\n+(?:我可以帮你|需要我帮你).{0,32}(?:找|搜|提供).{0,16}(?:下载|观看|播放|网盘)[^\n?？]*[?？]?/gi, "")
    .replace(/\[(\d+)\]/g, "")
    .replace(/^\[\d+\]\s*.+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractHighlights(summary, max = 6) {
  const lines = stripReferenceSection(summary)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const out = [];
  for (const line of lines) {
    let cleaned = line
      .replace(/^#{1,6}\s+/, "")
      .replace(/^[-*•]\s+/, "")
      .replace(/^\d+[.)]\s+/, "")
      .replace(/^\*\*(.+)\*\*$/, "$1")
      .replace(/\*\*/g, "")
      .trim();
    if (cleaned.startsWith("[") && cleaned.includes("]")) continue;
    if (cleaned.length < 6 || cleaned.length > 220) continue;
    if (/^参考来源|^检索|^用户问题/.test(cleaned)) continue;
    out.push(cleaned);
    if (out.length >= max) break;
  }
  return out;
}

function buildLiveInfoBlock(card) {
  return ["```liveinfo", JSON.stringify(card), "```"].join("\n");
}

export function formatLiveInfoReply({ kind, query, summary, results, fetchedAt, extra = {} }) {
  const meta = liveInfoKindMeta(kind);
  const cleaned = sanitizeLiveInfoSummary(stripReferenceSection(summary));
  const highlights = extractHighlights(cleaned);
  const headline =
    extra.headline ||
    highlights[0] ||
    cleaned.split("\n").find((l) => l.trim().length > 4)?.trim().slice(0, 120) ||
    query;

  const card = {
    kind,
    icon: extra.icon || meta.icon,
    title: extra.title || meta.title,
    headline: String(headline).slice(0, 160),
    highlights: extra.highlights || highlights.slice(0, 6),
    fetchedAt: fetchedAt || new Date().toISOString(),
    sources: [],
    meta: extra.meta || [],
  };

  const lines = [
    `**${card.title}** ${card.icon}`,
    "",
    cleaned || headline,
    "",
    buildLiveInfoBlock(card),
  ].filter((l) => l !== "");

  return lines.join("\n");
}

export function formatTrendsLiveReply(platform, list, updatedAt) {
  const label = platform === "xiaohongshu" ? "小红书探索热榜" : "抖音热搜榜";
  const icon = platform === "xiaohongshu" ? "📕" : "🎵";
  const highlights = (list || []).slice(0, 10).map((item, i) => {
    const heat = item.heat ? ` · ${formatHeat(item.heat)}` : "";
    const tag = item.tag ? ` · ${item.tag}` : "";
    return `${i + 1}. ${item.title}${heat}${tag}`;
  });

  const card = {
    kind: "trends",
    icon: "🔥",
    title: label,
    headline: highlights[0] ? `榜首：${(list[0]?.title || "").slice(0, 60)}` : "暂无榜单数据",
    highlights,
    fetchedAt: updatedAt || new Date().toISOString(),
    sources: [],
    meta: [{ label: "平台", value: platform === "xiaohongshu" ? "小红书" : "抖音" }],
  };

  const lines = [
    `**${label}** ${icon}`,
    "",
    ...highlights.slice(0, 8),
    "",
    buildLiveInfoBlock(card),
  ];

  return lines.join("\n");
}

const TIME_ZONES = [
  { re: /纽约|new york/i, label: "纽约", tz: "America/New_York", icon: "🗽" },
  { re: /伦敦|london/i, label: "伦敦", tz: "Europe/London", icon: "🇬🇧" },
  { re: /东京|tokyo/i, label: "东京", tz: "Asia/Tokyo", icon: "🗼" },
  { re: /巴黎|paris/i, label: "巴黎", tz: "Europe/Paris", icon: "🇫🇷" },
  { re: /悉尼|sydney/i, label: "悉尼", tz: "Australia/Sydney", icon: "🇦🇺" },
  { re: /洛杉矶|la\b/i, label: "洛杉矶", tz: "America/Los_Angeles", icon: "🌴" },
];

export function formatTimeLiveReply(text) {
  const msg = String(text || "");
  const hit = TIME_ZONES.find((z) => z.re.test(msg));
  const tz = hit?.tz || "Asia/Shanghai";
  const label = hit?.label || "北京时间";
  const icon = hit?.icon || "🕐";

  const now = new Date();
  const formatted = now.toLocaleString("zh-CN", {
    timeZone: tz,
    weekday: "short",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const card = {
    kind: "time",
    icon,
    title: `${label}当前时间`,
    headline: formatted,
    highlights: [`时区：${tz}`, `UTC：${now.toISOString().slice(0, 19).replace("T", " ")}`],
    fetchedAt: now.toISOString(),
    sources: [],
    meta: [{ label: "地点", value: label }],
  };

  return [
    `**${label}** ${icon}`,
    "",
    formatted,
    "",
    buildLiveInfoBlock(card),
  ].join("\n");
}
