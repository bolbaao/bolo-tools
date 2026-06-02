import dns from "dns/promises";
import net from "net";
import { URL } from "url";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  "::1",
  "metadata.google.internal",
  "metadata.goog",
]);

const BLOCKED_HOST_SUFFIXES = [".local", ".internal", ".localhost"];

const DOMAIN_PREFIX_RULES = [
  /channels\.weixin\.qq\.com|finder\.video\.qq\.com/i,
  /[\w.-]*douyin\.com|iesdouyin\.com|v\.douyin\.com/i,
  /bilibili\.com|b23\.tv|bili2233\.cn/i,
  /youtube\.com|youtu\.be/i,
  /twitter\.com|x\.com/i,
  /t\.me|telegram\.org|telesco\.pe/i,
  /instagram\.com|instagr\.am/i,
  /tiktok\.com/i,
  /facebook\.com|fb\.watch|fb\.com/i,
  /reddit\.com|redd\.it/i,
  /vimeo\.com/i,
  /pinterest\.com|pin\.it/i,
  /threads\.net/i,
  /twitch\.tv/i,
  /linkedin\.com/i,
  /snapchat\.com/i,
];

/** 从分享文案中提取并规范化视频链接 */
export function normalizeVideoInput(raw) {
  let text = String(raw ?? "").trim();
  if (!text) return "";

  const extracted = text.match(/https?:\/\/[^\s<>"'\u4e00-\u9fff]+/i);
  if (extracted) {
    text = extracted[0].replace(/[，。；,.;!?！？]+$/, "");
  }

  if (!/^https?:\/\//i.test(text)) {
    for (const rule of DOMAIN_PREFIX_RULES) {
      if (rule.test(text)) {
        text = `https://${text.replace(/^\/+/, "")}`;
        break;
      }
    }
  }

  return text.trim();
}

/** X/Twitter：从各类分享链接提取标准 status URL */
export function normalizeTwitterInput(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return "";

  let url = normalizeVideoInput(text);
  if (!url) return "";

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const isX =
      /^(www\.)?(twitter|x)\.com$/i.test(host) ||
      /^mobile\.twitter\.com$/i.test(host) ||
      /^(www\.)?(fx|vx)twitter\.com$/i.test(host);

    if (!isX) return url;

    // /i/web/status/123 或 /i/status/123
    const idFromPath =
      parsed.pathname.match(/\/status(?:es)?\/(\d+)/i)?.[1] ||
      parsed.pathname.match(/\/i\/(?:web\/)?status\/(\d+)/i)?.[1];

    if (idFromPath) {
      return `https://x.com/i/status/${idFromPath}`;
    }
    return url.split("#")[0].split("?")[0];
  } catch {
    return url;
  }
}

/** B 站：从 BV 号 / av 号规范化 */
export function normalizeBilibiliInput(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return "";

  const fromUrl = normalizeVideoInput(text);
  if (/bilibili\.com|b23\.tv|bili2233\.cn/i.test(fromUrl)) {
    return fromUrl;
  }

  const bv = text.match(/BV1[0-9A-Za-z]{9}/)?.[0];
  if (bv) return `https://www.bilibili.com/video/${bv}`;

  const av = text.match(/\bav(\d{6,})\b/i)?.[1];
  if (av) return `https://www.bilibili.com/video/av${av}`;

  return fromUrl;
}

function normalizeHostname(raw) {
  let host = String(raw ?? "").trim().toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) {
    host = host.slice(1, -1);
  }
  return host;
}

/** 将 hostname 解析为 IP 字面量（含十进制/十六进制编码） */
function parseIpLiteral(host) {
  const h = normalizeHostname(host);
  if (!h) return null;

  const ipVersion = net.isIP(h);
  if (ipVersion === 4 || ipVersion === 6) return h;

  if (/^\d+$/.test(h)) {
    const num = Number(h);
    if (Number.isFinite(num) && num >= 0 && num <= 0xffffffff) {
      return `${(num >>> 24) & 255}.${(num >>> 16) & 255}.${(num >>> 8) & 255}.${num & 255}`;
    }
  }

  if (/^0x[0-9a-f]+$/i.test(h)) {
    const num = Number.parseInt(h, 16);
    if (Number.isFinite(num) && num >= 0 && num <= 0xffffffff) {
      return `${(num >>> 24) & 255}.${(num >>> 16) & 255}.${(num >>> 8) & 255}.${num & 255}`;
    }
  }

  return null;
}

function isPrivateOrReservedIp(ip) {
  if (!ip) return false;

  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;
    return false;
  }

  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80:")) return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("::ffff:")) {
      return isPrivateOrReservedIp(lower.slice(7));
    }
  }

  return false;
}

function assertHostnameAllowed(hostname) {
  const host = normalizeHostname(hostname);
  if (!host) throw new Error("URL 格式无效");

  if (BLOCKED_HOSTS.has(host)) {
    throw new Error("不允许访问内网地址");
  }
  for (const suffix of BLOCKED_HOST_SUFFIXES) {
    if (host.endsWith(suffix)) {
      throw new Error("不允许访问内网地址");
    }
  }

  const ip = parseIpLiteral(host);
  if (ip && isPrivateOrReservedIp(ip)) {
    throw new Error("不允许访问内网地址");
  }

  if (
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^127\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    throw new Error("不允许访问内网地址");
  }
}

export function parseVideoUrl(raw) {
  const text = String(raw ?? "").trim();
  const isBilibiliHint =
    /bilibili|b23\.tv|bili2233|BV1[0-9A-Za-z]{9}|\bav\d{6,}\b/i.test(text);
  const isTwitterHint = /twitter\.com|x\.com|t\.co\/|fxtwitter|vxtwitter/i.test(text);

  let normalized;
  if (isBilibiliHint) {
    normalized = normalizeBilibiliInput(text);
  } else if (isTwitterHint) {
    normalized = normalizeTwitterInput(text);
  } else {
    normalized = normalizeVideoInput(text);
  }

  if (!normalized) {
    throw new Error("请输入视频链接");
  }
  try {
    return assertPublicHttpUrl(normalized);
  } catch (e) {
    if (e instanceof Error && e.message === "URL 格式无效") {
      if (isBilibiliHint) {
        throw new Error(
          "B 站链接无法识别。请粘贴 bilibili.com / b23.tv 链接，或文案中的 BV1… / av 号",
        );
      }
      throw new Error(
        "链接格式无法识别。请粘贴以 https:// 开头的完整分享链接",
      );
    }
    throw e;
  }
}

export function assertPublicHttpUrl(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("URL 格式无效");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("仅支持 http/https 链接");
  }
  assertHostnameAllowed(parsed.hostname);
  return parsed.toString();
}

/** 同步校验 + DNS 解析，防止域名指向内网 */
export async function assertPublicHttpUrlResolved(raw) {
  const safe = assertPublicHttpUrl(raw);
  const parsed = new URL(safe);
  const literal = parseIpLiteral(parsed.hostname);
  if (literal) return safe;

  let records;
  try {
    records = await dns.lookup(parsed.hostname, { all: true });
  } catch {
    throw new Error("无法解析目标域名");
  }

  for (const { address } of records) {
    if (isPrivateOrReservedIp(address)) {
      throw new Error("不允许访问内网地址");
    }
  }
  return safe;
}
