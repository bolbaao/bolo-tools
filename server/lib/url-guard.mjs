import { URL } from "url";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
]);

const DOMAIN_PREFIX_RULES = [
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

export function parseVideoUrl(raw) {
  const text = String(raw ?? "").trim();
  const isBilibiliHint =
    /bilibili|b23\.tv|bili2233|BV1[0-9A-Za-z]{9}|\bav\d{6,}\b/i.test(text);

  const normalized = isBilibiliHint
    ? normalizeBilibiliInput(text)
    : normalizeVideoInput(text);

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
  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local")) {
    throw new Error("不允许访问内网地址");
  }
  if (
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    throw new Error("不允许访问内网地址");
  }
  return parsed.toString();
}
