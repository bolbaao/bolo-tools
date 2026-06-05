import { getCookieStrategiesForPlatform } from "./video-platform.mjs";
import { runYtDlpJson } from "./ytdlp-runner.mjs";

function isCookieRelatedError(message, platform) {
  const text = message || "";
  if (
    /cookie|login|sign in|authenticate|private|members only|rate-limit|age.restricted|csrf|not authorized|authorized to view/i.test(
      text,
    )
  ) {
    return true;
  }
  // X 常把需登录/年龄限制的内容报成「找不到视频」，应继续尝试 Cookie
  if (
    platform === "twitter" &&
    /No video could be found|no video could be found|TweetTombstone|Unable to download JSON metadata/i.test(
      text,
    )
  ) {
    return true;
  }
  return false;
}

function shouldRetryAllStrategies(platform) {
  return platform === "twitter" || platform === "instagram";
}

/** yt-dlp 解析 YouTube / X / Telegram 等社交平台 */
export async function extractSocial(url, platform) {
  const strategies = getCookieStrategiesForPlatform(platform);
  let lastError = null;

  for (const strategy of strategies) {
    try {
      const info = await runYtDlpJson(url, platform, strategy.args);
      return { info, cookieSource: strategy.name };
    } catch (e) {
      lastError = e;
      const msg = e instanceof Error ? e.message : "";
      if (!shouldRetryAllStrategies(platform) && !isCookieRelatedError(msg, platform)) {
        throw e;
      }
    }
  }

  throw lastError || new Error("解析失败");
}
