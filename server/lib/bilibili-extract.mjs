import { getBilibiliCookieStrategies } from "./video-platform.mjs";
import { runYtDlpJson } from "./ytdlp-runner.mjs";

function isAuthOrCookieError(message) {
  return /cookie|login|会员|鉴权|412|352|premium|VIP|需要登录/i.test(message || "");
}

async function tryStrategies(url, strategies) {
  let lastError = null;
  for (const strategy of strategies) {
    try {
      const info = await runYtDlpJson(url, "bilibili", strategy.args);
      return { info, cookieSource: strategy.name };
    } catch (e) {
      lastError = e;
      if (!isAuthOrCookieError(e instanceof Error ? e.message : "")) {
        throw e;
      }
    }
  }
  return { error: lastError };
}

/** B 站解析：yt-dlp + Cookie（高清/会员画质建议登录后导出 Cookie） */
export async function extractBilibili(url) {
  const strategies = getBilibiliCookieStrategies();
  const result = await tryStrategies(url, strategies);
  if (!result.error) return result;
  throw result.error || new Error("哔哩哔哩解析失败");
}
