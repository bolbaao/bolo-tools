import axios from "axios";
import { env } from "./env.mjs";

const DEFAULT_BASE = "http://1.h88818.net/v";
const TOKEN_TTL_MS = 5 * 60 * 1000;

const BLOCKED_KEYWORDS = [
  "色情",
  "黄片",
  "三级片",
  "强奸",
  "援交",
  "口交",
  "无码",
  "幼女",
  "性爱",
];

/** 多路 API 并行检索，按分组合并后面向用户展示 */
const SOURCE_DEFS = [
  { id: "dyfx", group: "primary", groupLabel: "相关结果", path: "/api/getDyfx", kind: "simple" },
  { id: "ttzjb", group: "primary", groupLabel: "相关结果", path: "/api/getTTZJB", kind: "simple" },
  { id: "juzi", group: "extended", groupLabel: "更多结果", path: "/api/getJuzi", kind: "simple" },
  { id: "girls", group: "more", groupLabel: "更多结果", path: "/api/getGirls", kind: "simple" },
];

const GROUP_ORDER = ["primary", "extended", "more"];

function mergeSectionsByGroup(sections) {
  const map = new Map();
  for (const section of sections) {
    const def = SOURCE_DEFS.find((s) => s.id === section.sourceId);
    const group = def?.group ?? section.sourceId;
    const label = def?.groupLabel ?? section.source;
    const existing = map.get(group);
    if (existing) {
      existing.items.push(...section.items);
    } else {
      map.set(group, { source: label, sourceId: group, items: [...section.items] });
    }
  }
  return GROUP_ORDER.filter((g) => map.has(g)).map((g) => map.get(g));
}

const LINK_PATTERNS = [
  { platform: "baidu", label: "百度网盘", re: /https?:\/\/(?:pan\.)?baidu\.com\/[^\s<>"']+/gi },
  { platform: "xunlei", label: "迅雷网盘", re: /https?:\/\/pan\.xunlei\.com\/[^\s<>"']+/gi },
  { platform: "quark", label: "夸克网盘", re: /https?:\/\/pan\.quark\.cn\/[^\s<>"']+/gi },
  { platform: "alipan", label: "阿里云盘", re: /https?:\/\/(?:www\.)?alipan\.com\/[^\s<>"']+/gi },
  { platform: "uc", label: "UC网盘", re: /https?:\/\/drive\.uc\.cn\/[^\s<>"']+/gi },
];

let tokenCache = { token: "", expiresAt: 0 };

function apiBase() {
  return env("MEDIA_RESOURCE_API_BASE", DEFAULT_BASE).replace(/\/$/, "");
}

function tabName() {
  return env("MEDIA_RESOURCE_TAB", "movie_test");
}

export function assertSearchAllowed(query) {
  const q = String(query || "").trim();
  if (!q) return { ok: false, error: "请输入搜索关键词" };
  if (q.length > 50) return { ok: false, error: "关键词过长，请精简后再试" };
  for (const word of BLOCKED_KEYWORDS) {
    if (q.includes(word)) return { ok: false, error: "该搜索内容已被屏蔽" };
  }
  return { ok: true, query: q };
}

async function getToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }
  const { data } = await axios.get(`${apiBase()}/api/gettoken`, { timeout: 10000 });
  const token = data?.token;
  if (!token) throw new Error("资源接口 token 获取失败");
  tokenCache = { token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return token;
}

function cleanUrl(raw) {
  return String(raw || "")
    .replace(/[)\]}>,.;，。！？!?]+$/g, "")
    .replace(/#+$/, "");
}

function extractPassword(text, url) {
  const line =
    text
      .split("\n")
      .find((l) => l.includes(url))
      ?.trim() || text;
  const patterns = [
    /(?:提取码|密码|pwd)[:：\s]*([a-zA-Z0-9]{3,8})/i,
    /[?&]pwd=([a-zA-Z0-9]{3,8})/i,
  ];
  for (const re of patterns) {
    const m = line.match(re);
    if (m) return m[1];
  }
  return undefined;
}

export function parseResourceLinks(text) {
  const source = String(text || "");
  const found = [];
  const seen = new Set();

  for (const { platform, label, re } of LINK_PATTERNS) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(source)) !== null) {
      const url = cleanUrl(match[0]);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      found.push({
        platform,
        label,
        url,
        password: extractPassword(source, url),
      });
    }
  }

  return found;
}

function titleFromItem(item) {
  const q = String(item.question || "").trim();
  if (q) return q;
  const answer = String(item.answer || "").trim();
  const firstLine = answer.split("\n").find((l) => l.trim()) || answer;
  return firstLine.slice(0, 120);
}

function normalizeItems(rawList, sourceId) {
  const items = [];
  for (const raw of rawList || []) {
    const answer = String(raw.answer || "").trim();
    const title = titleFromItem(raw);
    const links = parseResourceLinks(answer);
    if (!answer && !title) continue;
    items.push({
      id: `${sourceId}-${raw.id ?? title.slice(0, 24)}`,
      title,
      content: answer,
      links,
      poster: raw.bd_pic || null,
    });
  }
  return items;
}

async function postSource(source, token, query) {
  const payload = { name: query, token };
  if (source.kind === "sortWeb") {
    Object.assign(payload, {
      tabN: tabName(),
      topNo: 12,
      whr: `question like "%${query}%"`,
      orderBy: "date_time",
      orderType: "DESC",
      keys: "question,answer,id",
    });
  }

  const { data } = await axios.post(`${apiBase()}${source.path}`, new URLSearchParams(payload), {
    timeout: 15000,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (data?.status === false) {
    return { source: source.groupLabel, sourceId: source.id, items: [], error: data.msg || null };
  }

  const list = Array.isArray(data?.list) ? data.list : [];
  return {
    source: source.groupLabel,
    sourceId: source.id,
    items: normalizeItems(list, source.id),
    error: null,
  };
}

export async function searchMediaResources(query) {
  const check = assertSearchAllowed(query);
  if (!check.ok) return check;

  const token = await getToken();
  const settled = await Promise.allSettled(
    SOURCE_DEFS.map((source) => postSource(source, token, check.query)),
  );

  const sections = [];
  const errors = [];

  for (let i = 0; i < settled.length; i += 1) {
    const result = settled[i];
    const def = SOURCE_DEFS[i];
    if (result.status === "rejected") {
      errors.push(`${def.groupLabel}: ${result.reason?.message || "请求失败"}`);
      continue;
    }
    const section = result.value;
    if (section.error) errors.push(`${def.groupLabel}: ${section.error}`);
    if (section.items.length > 0) sections.push(section);
  }

  const mergedSections = mergeSectionsByGroup(sections);
  const flatItems = mergedSections.flatMap((s) => s.items);
  const uniqueLinks = new Map();
  for (const item of flatItems) {
    for (const link of item.links) {
      if (!uniqueLinks.has(link.url)) uniqueLinks.set(link.url, link);
    }
  }

  return {
    ok: true,
    query: check.query,
    sections: mergedSections,
    stats: {
      sections: mergedSections.length,
      items: flatItems.length,
      links: uniqueLinks.size,
    },
    errors: errors.length ? errors : undefined,
  };
}

export function buildCopyText(result) {
  const lines = [`${result.query}`, ""];
  for (const section of result.sections) {
    if (section.items.length === 0) continue;
    lines.push(`【${section.source}】`);
    for (const item of section.items) {
      lines.push(item.title);
      if (item.content) lines.push(item.content);
      lines.push("");
    }
  }
  return lines.join("\n").trim();
}
