import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "../env.mjs";
import { SOCIAL_PUBLISH_PLATFORMS } from "./platforms.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..", "..", "..");

function resolveProjectPath(p) {
  if (!p) return null;
  const abs = path.isAbsolute(p) ? p : path.join(PROJECT_ROOT, p);
  return fs.existsSync(abs) && fs.statSync(abs).isFile() ? abs : null;
}

/** @param {import("./platforms.mjs").SOCIAL_PUBLISH_PLATFORMS[string]} platform */
export function getAccountStatus(platform) {
  const cookieFile = (platform.cookieEnv || [])
    .map((k) => env(k))
    .find(Boolean);
  const fileFromEnv = cookieFile ? resolveProjectPath(cookieFile) : null;
  const fileFromDefault = (platform.cookieFiles || [])
    .map((p) => resolveProjectPath(p))
    .find(Boolean);
  const cookiePath = fileFromEnv || fileFromDefault;
  const browser = env(platform.cookieBrowserEnv);
  const hasCookieFile = Boolean(cookiePath);
  const hasBrowser = Boolean(browser);
  const ready = hasCookieFile || hasBrowser;
  let hint = "";
  if (!ready) {
    if (platform.id === "douyin") {
      hint = "运行 ./scripts/setup-douyin-cookies.sh 并在浏览器登录抖音创作者账号";
    } else if (platform.id === "weixin-channels") {
      hint = "运行 ./scripts/setup-yuanbao-cookies.sh（Safari 登录元宝/视频号）";
    } else {
      hint = `导出 ${platform.label} Cookie 到 cookies/${platform.id}.txt，或在 .env 配置 ${platform.cookieEnv?.[0]}`;
    }
  } else if (hasBrowser) {
    hint = `将使用浏览器 Cookie（${browser}）`;
  } else {
    hint = `已找到 Cookie 文件：${path.relative(PROJECT_ROOT, cookiePath)}`;
  }
  return {
    platformId: platform.id,
    ready,
    hasCookieFile,
    hasBrowser,
    cookiePath: cookiePath ? path.relative(PROJECT_ROOT, cookiePath) : null,
    hint,
  };
}

export function listAccountsStatus() {
  return Object.values(SOCIAL_PUBLISH_PLATFORMS).map((p) => getAccountStatus(p));
}
