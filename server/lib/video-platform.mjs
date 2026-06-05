import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..", "..");

export const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.42";

/** 平台检测规则（顺序优先） */
const PLATFORM_RULES = [
  {
    id: "weixin-channels",
    pattern: /channels\.weixin\.qq\.com|finder\.video\.qq\.com|wxapp\.tc\.qq\.com/i,
  },
  { id: "douyin", pattern: /douyin\.com|iesdouyin\.com|douyinvod\.com|v\.douyin\.com/i },
  { id: "bilibili", pattern: /bilibili\.com|b23\.tv|bili2233\.cn|bilivideo\.com/i },
  { id: "youtube", pattern: /youtube\.com|youtu\.be|youtube-nocookie\.com/i },
  { id: "twitter", pattern: /twitter\.com|x\.com|t\.co\/|twimg\.com/i },
  { id: "telegram", pattern: /t\.me\/|telegram\.org|telesco\.pe/i },
  { id: "instagram", pattern: /instagram\.com|instagr\.am|cdninstagram\.com/i },
  { id: "tiktok", pattern: /tiktok\.com|tiktokv\.com/i },
  { id: "facebook", pattern: /facebook\.com|fb\.watch|fb\.com\/|fbcdn\.net/i },
  { id: "reddit", pattern: /reddit\.com|redd\.it|v\.redd\.it/i },
  { id: "vimeo", pattern: /vimeo\.com|player\.vimeo\.com/i },
  { id: "pinterest", pattern: /pinterest\.com|pin\.it/i },
  { id: "threads", pattern: /threads\.net/i },
  { id: "twitch", pattern: /twitch\.tv|clips\.twitch\.tv/i },
  { id: "linkedin", pattern: /linkedin\.com/i },
  { id: "snapchat", pattern: /snapchat\.com/i },
];

export const PLATFORM_REFERERS = {
  "weixin-channels": "https://channels.weixin.qq.com/",
  douyin: "https://www.douyin.com/",
  bilibili: "https://www.bilibili.com/",
  youtube: "https://www.youtube.com/",
  twitter: "https://x.com/",
  telegram: "https://t.me/",
  instagram: "https://www.instagram.com/",
  tiktok: "https://www.tiktok.com/",
  facebook: "https://www.facebook.com/",
  reddit: "https://www.reddit.com/",
  vimeo: "https://vimeo.com/",
  pinterest: "https://www.pinterest.com/",
  threads: "https://www.threads.net/",
  twitch: "https://www.twitch.tv/",
  linkedin: "https://www.linkedin.com/",
  snapchat: "https://www.snapchat.com/",
};

export const PLATFORM_LABELS = {
  "weixin-channels": "微信视频号",
  douyin: "抖音",
  bilibili: "哔哩哔哩",
  youtube: "YouTube",
  twitter: "X (Twitter)",
  telegram: "Telegram",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  reddit: "Reddit",
  vimeo: "Vimeo",
  pinterest: "Pinterest",
  threads: "Threads",
  twitch: "Twitch",
  linkedin: "LinkedIn",
  snapchat: "Snapchat",
  generic: "其他",
};

export function resolveCookiesPath(raw) {
  if (!raw) return null;
  const p = raw.startsWith("~")
    ? path.join(process.env.HOME || "", raw.slice(1))
    : path.isAbsolute(raw)
      ? raw
      : path.join(PROJECT_ROOT, raw);
  return fs.existsSync(p) ? p : null;
}

export function detectPlatform(url) {
  const u = url.toLowerCase();
  for (const { id, pattern } of PLATFORM_RULES) {
    if (pattern.test(u)) return id;
  }
  return "generic";
}

export function isSupportedPlatform(platform) {
  return (
    platform === "generic" ||
    PLATFORM_RULES.some((r) => r.id === platform) ||
    platform === "douyin" ||
    platform === "bilibili"
  );
}

export function usesYtDlp(platform) {
  return platform !== "douyin";
}

export function sortFormatsByQuality(platform) {
  return [
    "weixin-channels",
    "bilibili",
    "youtube",
    "twitter",
    "instagram",
    "tiktok",
    "facebook",
    "reddit",
    "vimeo",
    "twitch",
    "telegram",
  ].includes(platform);
}

/** X 帖文 / t.co：yt-dlp 自行跳转，Node fetch 对 t.co 常失败 */
export function shouldResolveFinalUrl(url, platform) {
  if (platform === "weixin-channels") return false;
  if (platform === "twitter") {
    if (/t\.co\//i.test(url)) return false;
    if (/\/status(?:es)?\/\d+/i.test(url)) return false;
    if (/\/i\/(?:web\/)?status\/\d+/i.test(url)) return false;
    return false;
  }
  return true;
}

export async function resolveFinalUrl(url, platform) {
  if (!shouldResolveFinalUrl(url, platform)) return url;
  const ua = platform === "douyin" ? MOBILE_UA : DESKTOP_UA;
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": ua, Accept: "text/html,*/*" },
      signal: AbortSignal.timeout(15000),
    });
    return res.url || url;
  } catch {
    return url;
  }
}

export function buildYtDlpBaseArgs(platform) {
  const args = ["--no-playlist", "--no-warnings", "-j", "--skip-download"];
  args.push("--user-agent", platform === "douyin" ? MOBILE_UA : DESKTOP_UA);
  const referer = PLATFORM_REFERERS[platform];
  if (referer) args.push("--referer", referer);
  return args;
}

function addCookieStrategies(strategies, seen, filePaths, browsers) {
  const add = (name, args) => {
    const key = args.join(" ");
    if (seen.has(key)) return;
    seen.add(key);
    strategies.push({ name, args });
  };

  for (const p of filePaths) {
    const resolved = resolveCookiesPath(p);
    if (resolved) add("cookies.txt", ["--cookies", resolved]);
  }
  for (const b of browsers) {
    if (b) add(`browser:${b}`, ["--cookies-from-browser", b]);
  }
}

export function getDouyinCookieStrategies() {
  const strategies = [];
  const seen = new Set();
  const preferred = env("YTDLP_COOKIES_FROM_BROWSER") || "safari";
  const browsers = [preferred, "safari", "chrome", "chromium", "brave", "edge", "firefox"];

  const filePaths = [env("YTDLP_COOKIES"), env("DOUYIN_COOKIES"), "./cookies/douyin.txt"];
  for (const p of filePaths) {
    const resolved = resolveCookiesPath(p);
    if (resolved) {
      seen.add(`--cookies ${resolved}`);
      strategies.push({ name: "cookies.txt", args: ["--cookies", resolved] });
    }
  }
  for (const b of browsers) {
    if (b && !seen.has(`--cookies-from-browser ${b}`)) {
      seen.add(`--cookies-from-browser ${b}`);
      strategies.push({ name: `browser:${b}`, args: ["--cookies-from-browser", b] });
    }
  }
  return strategies;
}

export function getBilibiliCookieStrategies() {
  const strategies = [];
  const seen = new Set();
  const preferred = env("BILIBILI_COOKIES_FROM_BROWSER") || env("YTDLP_COOKIES_FROM_BROWSER") || "safari";
  const browsers = [preferred, "safari", "chrome", "chromium", "brave", "edge", "firefox"];
  addCookieStrategies(strategies, seen, [env("BILIBILI_COOKIES"), "./cookies/bilibili.txt"], browsers);
  return strategies;
}

/** YouTube / Instagram 等：可选 Cookie（登录后清晰度更高） */
export function getSocialCookieStrategies() {
  const strategies = [];
  const seen = new Set();
  const preferred = env("SOCIAL_COOKIES_FROM_BROWSER") || env("YTDLP_COOKIES_FROM_BROWSER") || "safari";
  const browsers = [preferred, "safari", "chrome", "chromium", "brave", "edge", "firefox"];
  addCookieStrategies(
    strategies,
    seen,
    [env("SOCIAL_COOKIES"), "./cookies/social.txt"],
    browsers,
  );
  strategies.unshift({ name: "default", args: [] });
  return strategies;
}

const KNOWN_COOKIE_BROWSERS = new Set([
  "safari",
  "chrome",
  "chromium",
  "brave",
  "edge",
  "firefox",
  "opera",
  "vivaldi",
]);

function filterCookieBrowsers(browsers) {
  return browsers.filter((b) => b && KNOWN_COOKIE_BROWSERS.has(String(b).toLowerCase()));
}

/** X/Twitter：先无 Cookie（公开帖），再尝试 Cookie（需登录帖）；过期 Cookie 不应阻断解析 */
export function getTwitterCookieStrategies() {
  const strategies = [{ name: "default", args: [] }];
  const seen = new Set([""]);
  const preferred =
    env("TWITTER_COOKIES_FROM_BROWSER") ||
    env("SOCIAL_COOKIES_FROM_BROWSER") ||
    env("YTDLP_COOKIES_FROM_BROWSER") ||
    "safari";
  const browsers = filterCookieBrowsers([
    preferred,
    "safari",
    "chrome",
    "chromium",
    "brave",
    "edge",
    "firefox",
  ]);
  addCookieStrategies(
    strategies,
    seen,
    [env("TWITTER_COOKIES"), env("SOCIAL_COOKIES"), "./cookies/x.txt", "./cookies/social.txt"],
    browsers,
  );
  return strategies;
}

export function getCookieStrategiesForPlatform(platform) {
  if (platform === "douyin") return getDouyinCookieStrategies();
  if (platform === "bilibili") return getBilibiliCookieStrategies();
  if (platform === "twitter") return getTwitterCookieStrategies();
  if (platform !== "generic" && PLATFORM_REFERERS[platform]) {
    return getSocialCookieStrategies();
  }
  return [{ name: "default", args: [] }];
}

export function buildYtDlpArgs(platform) {
  const args = buildYtDlpBaseArgs(platform);
  const first = getCookieStrategiesForPlatform(platform)[0];
  if (first?.args?.length) args.push(...first.args);
  return args;
}

export function formatYtDlpError(stderr, platform) {
  const text = stderr || "";
  if (text.includes("ENOENT") || text.includes("not found")) {
    return "未安装 yt-dlp。请运行: pip3 install -U yt-dlp 或 brew install yt-dlp";
  }
  if (platform === "douyin" && /cookie|Fresh cookies/i.test(text)) {
    const browser = env("YTDLP_COOKIES_FROM_BROWSER") || "safari";
    return `抖音 Cookie 已失效。请在 ${browser} 登录 douyin.com 后运行 ./scripts/setup-douyin-cookies.sh ${browser}`;
  }
  if (platform === "bilibili" && /login|352|412|会员|鉴权|cookie/i.test(text)) {
    const browser = env("BILIBILI_COOKIES_FROM_BROWSER") || env("YTDLP_COOKIES_FROM_BROWSER") || "safari";
    return `该 B 站视频可能需要登录。请在 ${browser} 登录 bilibili.com 后运行 ./scripts/setup-bilibili-cookies.sh`;
  }
  if (platform === "youtube" && /sign in|login|private|members only/i.test(text)) {
    const browser = env("SOCIAL_COOKIES_FROM_BROWSER") || env("YTDLP_COOKIES_FROM_BROWSER") || "safari";
    return `该 YouTube 视频需要登录或为私密视频。请在 ${browser} 登录 YouTube 后配置 Cookie（见 .env.example）`;
  }
  if (
    platform === "twitter" &&
    /login|authenticate|private|csrf|not authorized|No video could be found|no video/i.test(text)
  ) {
    return "X 视频解析失败。请确认链接为含视频的推文（非纯图片/文字帖）；需登录才能看的视频请运行 ./scripts/setup-x-cookies.sh 配置 Cookie";
  }
  if (platform === "twitter" && /Unable to download webpage|unable to download webpage/i.test(text)) {
    return "无法打开 X 链接。请粘贴完整推文地址（x.com/…/status/数字 或分享文案中的链接），并检查网络或 .env 中的 HTTPS_PROXY";
  }
  if (platform === "instagram" && /login|cookie|rate-limit/i.test(text)) {
    return "Instagram 通常需要登录 Cookie。请在 Safari 登录 instagram.com 后配置 SOCIAL_COOKIES";
  }
  if (platform === "weixin-channels") {
    return "微信视频号解析失败。请粘贴含 oid 的完整分享链接，并运行 ./scripts/setup-yuanbao-cookies.sh（Safari 登录元宝）";
  }
  if (/Unsupported URL|invalid url|no video/i.test(text)) {
    const label = PLATFORM_LABELS[platform] || platform;
    return `无法解析该${label}链接，请确认链接完整且内容为公开视频`;
  }
  if (/SSLError|SSL.*EOF|certificate verify failed|wrong version number/i.test(text)) {
    const proxyHint = env("HTTPS_PROXY") || env("HTTP_PROXY")
      ? ""
      : "。访问 YouTube 等境外站点请在 .env 配置 HTTPS_PROXY=http://127.0.0.1:7890";
    return `网络 SSL 握手失败${proxyHint}。也可运行 ./scripts/download-ytdlp.sh 安装独立版 yt-dlp（避免 macOS 自带 Python 3.9 的 SSL 问题）`;
  }
  if (/Python version 3\.9 has been deprecated|NotOpenSSLWarning/i.test(text)) {
    return "yt-dlp 使用的 Python 3.9 过旧，SSL 可能异常。请运行 ./scripts/download-ytdlp.sh 或 brew install yt-dlp 更新";
  }
  return text.slice(-500) || "解析失败";
}
