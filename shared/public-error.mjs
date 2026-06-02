/** 面向网站用户：不暴露 .env、部署命令、密钥名等运维细节 */

export const AI_SERVICE_UNAVAILABLE =
  "AI 服务暂时不可用，请稍后再试。如需开通请联系客服。";

export const FEATURE_UNAVAILABLE =
  "该功能暂时不可用，请稍后再试。如需开通请联系客服。";

export const IMAGE_VISION_UNAVAILABLE =
  "图片识别暂不可用，请稍后再试。如需开通请联系客服。";

const VISION_API_HINT =
  /401|403|invalid.*key|authentication|api key|密钥|未配置|额度|credit|spending limit/i;

/**
 * 视觉 API 失败原因：不向用户/对话模型暴露密钥、鉴权等运维细节
 * @param {string | null | undefined} raw
 * @returns {string | null}
 */
export function sanitizeVisionApiError(raw) {
  const msg = String(raw ?? "").trim();
  if (!msg) return null;
  if (VISION_API_HINT.test(msg)) return IMAGE_VISION_UNAVAILABLE;
  return toUserFacingErrorMessage(msg);
}

const DEV_HINT =
  /(?:\.env(?:\.example)?|start\.sh|环境变量|API[_\s]?Key|ARK_VISION_API_KEY|ARK_API_KEY|DEEPSEEK_API_KEY|TAVILY_API_KEY|SERPER_API_KEY|CONVERTAPI|HTTPS?_PROXY|NODE_ENV|pip install|faster-whisper|LIBREOFFICE|未配置|请运行:|cookies\/|YTDLP|yt-dlp)/i;

const AI_HINT =
  /(?:AI|对话|模型|DeepSeek|火山|方舟|OpenAI|chat|转写|生图|修图|写作|工作流)/i;

/**
 * @param {string} raw
 * @returns {string}
 */
export function toUserFacingErrorMessage(raw) {
  const msg = String(raw ?? "").trim();
  if (!msg) return "操作失败，请稍后再试";

  if (/127\.0\.0\.1|localhost/i.test(msg)) {
    return "服务暂时无法连接，请刷新页面或稍后再试";
  }

  if (DEV_HINT.test(msg)) {
    return AI_HINT.test(msg) ? AI_SERVICE_UNAVAILABLE : FEATURE_UNAVAILABLE;
  }

  if (/请检查.*API Key|重启\s*\.\/start\.sh/i.test(msg)) {
    return AI_HINT.test(msg) ? AI_SERVICE_UNAVAILABLE : FEATURE_UNAVAILABLE;
  }

  return msg;
}
