import { getCookieStrategiesForPlatform } from "./video-platform.mjs";
import { runYtDlpJson } from "./ytdlp-runner.mjs";

function isCookieRelatedError(message) {
  return /cookie|login|sign in|authenticate|private|members only|rate-limit|age.restricted/i.test(
    message || "",
  );
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
      if (!isCookieRelatedError(msg)) {
        throw e;
      }
    }
  }

  throw lastError || new Error("解析失败");
}
