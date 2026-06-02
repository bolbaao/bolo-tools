import { assertSearchAllowed, searchMediaResources } from "./media-resource-fetch.mjs";
import { formatResourceNotFound } from "../../shared/public-error.mjs";

const MEDIA_INTENT_RE =
  /(?:想|要|想要|帮我)?(?:看|追|找|搜|查)|(?:下载|网盘|资源|链接)|在哪(?:儿)?看|哪里看|怎么看(?:下载)?|有没有|有(?:没有)?(?:资源|网盘)/;

const NON_MEDIA_RE =
  /是什么|什么意思|为什么|怎么样|如何|介绍|讲解|评价|剧情|结局|多少集|谁是谁|好看吗|值得看吗|讲什么|概述|百科/;

const KEYWORD_PATTERNS = [
  /(?:想|要|想要)(?:看|追)(?:一下|下)?[《「『""]?([^》」』""?\n，。！？!?\s]{2,30})[》」』""]?/,
  /(?:帮我)?(?:搜|找|查)(?:一下|下)?[《「『""]?([^》」』""?\n，。！？!?\s]{2,30})[》」』""]?/,
  /[《「『""]([^》」』""]{2,30})[》」』""]/,
  /([^，。！？!?\s]{2,24})(?:在哪(?:儿)?看|哪里看|的?(?:下载链接|网盘|资源))/,
  /(?:下载|网盘)[《「『""]?([^》」』""?\n，。！？!?\s]{2,30})[》」』""]?/,
];

function stripKeyword(raw) {
  return String(raw || "")
    .replace(/^(?:一部|那个|这个|个|点)/, "")
    .replace(/(?:的)?(?:资源|网盘|下载链接|下载|链接|视频|电影|动漫|剧集|电视剧|番剧)$/, "")
    .replace(/[吗呢啊吧呀]$/, "")
    .trim();
}

export function detectMediaSearchIntent(text) {
  const msg = String(text || "").trim();
  if (!msg || msg.length > 80) return false;
  if (/https?:\/\//i.test(msg)) return false;
  if (NON_MEDIA_RE.test(msg)) return false;
  return MEDIA_INTENT_RE.test(msg);
}

export function extractMediaKeyword(text) {
  const msg = String(text || "").trim();
  for (const re of KEYWORD_PATTERNS) {
    const m = msg.match(re);
    if (m?.[1]) {
      const kw = stripKeyword(m[1]);
      if (kw.length >= 2 && kw.length <= 30) return kw;
    }
  }
  const fallback = msg
    .replace(/^(?:我)?(?:想|要|想要|帮我)(?:看|追|找|搜|查)(?:一下|下)?/, "")
    .replace(/(?:在哪(?:儿)?看|哪里看|怎么看|下载|网盘|资源|链接).*$/, "")
    .trim();
  const kw = stripKeyword(fallback);
  return kw.length >= 2 && kw.length <= 30 ? kw : null;
}

export function formatMediaSearchReply(result) {
  if (!result.ok) {
    return formatResourceNotFound(result.query);
  }

  const { query, sections, stats } = result;
  if (!stats?.links) {
    return formatResourceNotFound(query);
  }

  const byPlatform = new Map();

  for (const section of sections) {
    for (const item of section.items) {
      for (const link of item.links) {
        const list = byPlatform.get(link.label) ?? [];
        if (!list.some((l) => l.url === link.url)) {
          list.push({ ...link, title: item.title });
          byPlatform.set(link.label, list);
        }
      }
    }
  }

  const lines = [`**${query}** 的相关结果：`, ""];

  for (const [label, links] of byPlatform) {
    lines.push(`**${label}**`);
    for (const link of links.slice(0, 4)) {
      let row = `- ${link.url}`;
      if (link.password) row += `（提取码：\`${link.password}\`）`;
      lines.push(row);
    }
    lines.push("");
  }

  lines.push("_若链接失效，可换关键词再试试。_");
  return lines.join("\n").trim();
}

/**
 * @param {string} userMessage
 * @returns {Promise<string | null>}
 */
export async function tryMediaSearchReply(userMessage) {
  if (!detectMediaSearchIntent(userMessage)) return null;

  const keyword = extractMediaKeyword(userMessage);
  if (!keyword) return null;

  const allowed = assertSearchAllowed(keyword);
  if (!allowed.ok) return null;

  try {
    const result = await searchMediaResources(keyword);
    return formatMediaSearchReply(result);
  } catch {
    return null;
  }
}
