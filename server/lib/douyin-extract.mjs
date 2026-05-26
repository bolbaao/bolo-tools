import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  buildYtDlpBaseArgs,
  formatYtDlpError,
  getDouyinCookieStrategies,
} from "./video-platform.mjs";
import { refreshDouyinCookies } from "./refresh-douyin-cookies.mjs";
import { extractDouyinWeb } from "./douyin-web.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..", "..");

function resolveYtDlpBin() {
  const local = path.join(PROJECT_ROOT, ".local", "bin", "yt-dlp");
  if (process.env.YTDLP_BIN) return process.env.YTDLP_BIN;
  return fs.existsSync(local) ? local : "yt-dlp";
}

function runYtDlpOnce(url, extraArgs) {
  return new Promise((resolve, reject) => {
    const bin = resolveYtDlpBin();
    const args = [...buildYtDlpBaseArgs("douyin"), ...extraArgs, url];
    const proc = spawn(bin, args, {
      env: {
        ...process.env,
        PATH: `${path.join(PROJECT_ROOT, ".local", "bin")}:${process.env.PATH || ""}`,
      },
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(formatYtDlpError(stderr, "douyin")));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error("解析视频信息失败"));
      }
    });
    proc.on("error", (e) => {
      if (e.code === "ENOENT") {
        reject(new Error("未安装 yt-dlp。请运行: pip3 install -U yt-dlp"));
      } else reject(e);
    });
  });
}

function isCookieRelatedError(message) {
  return /cookie|Fresh cookies|cookiesfrombrowser|Could not copy/i.test(message || "");
}

async function tryYtDlpStrategies(url, strategies) {
  let lastError = null;
  for (const strategy of strategies) {
    try {
      const info = await runYtDlpOnce(url, strategy.args);
      return { info, cookieSource: strategy.name };
    } catch (e) {
      lastError = e;
      if (!isCookieRelatedError(e instanceof Error ? e.message : "")) {
        throw e;
      }
    }
  }
  return { error: lastError };
}

/**
 * 优先网页解析（西瓜工具同款，通常无需 Cookie），失败再试 yt-dlp
 */
export async function extractDouyin(url) {
  try {
    return await extractDouyinWeb(url);
  } catch (webErr) {
    /* fallback */
  }

  let strategies = getDouyinCookieStrategies();
  let result = await tryYtDlpStrategies(url, strategies);

  if (!result.error) return result;

  const refreshed = await refreshDouyinCookies();
  if (refreshed) {
    strategies = getDouyinCookieStrategies();
    result = await tryYtDlpStrategies(url, strategies);
    if (!result.error) {
      return { ...result, cookieSource: `${result.cookieSource} (refreshed)` };
    }
  }

  try {
    return await extractDouyinWeb(url);
  } catch {
    /* use yt-dlp error below */
  }

  throw (
    result.error ||
    new Error("抖音解析失败，请确认链接有效且视频为公开内容")
  );
}
