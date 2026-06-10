/** 面向网站用户：不暴露 .env、部署命令、密钥名等运维细节 */

export const AI_SERVICE_UNAVAILABLE =
  "AI 服务暂时不可用，请稍后再试。如需开通请联系客服。";

export const FEATURE_UNAVAILABLE =
  "该功能暂时不可用，请稍后再试。如需开通请联系客服。";

export const IMAGE_VISION_UNAVAILABLE =
  "图片识别暂不可用，请稍后再试。如需开通请联系客服。";

/**
 * 全网搜索未命中时，不暴露检索渠道
 * @param {string} query
 */
export function formatSearchNotFound(query) {
  const q = String(query || "该内容").trim() || "该内容";
  return `暂时没找到「${q}」的相关信息，换个关键词再试试？`;
}

/**
 * 资源搜索未命中时，不暴露检索渠道或方式
 * @param {string} query
 */
export function formatResourceNotFound(query) {
  const q = String(query || "该内容").trim() || "该内容";
  return `暂时没找到「${q}」的资源，换个关键词或别名再试试？`;
}

/**
 * 图片 / Logo 检索未命中
 * @param {string} query
 */
export function formatImageNotFound(query) {
  const raw = String(query || "该图片").trim() || "该图片";
  const q = raw
    .replace(/(?:的)?(?:相关)?(?:高清)?(?:宣传)?(?:配图|图片|照片|图像|素材)/gi, " ")
    .replace(/\s+/g, " ")
    .trim() || raw;
  return `未能检索到与「${q}」相关的可用图片。请补充更具体的描述（如门店外观、logo、宣传海报），或直接粘贴图片链接。`;
}

export function formatImageSearchUnavailable() {
  return FEATURE_UNAVAILABLE;
}

export function formatPptGenerateUnavailable() {
  return FEATURE_UNAVAILABLE;
}

/**
 * 视频校验未通过
 * @param {string} query
 */
export function formatVideoVerifyFailed(query) {
  const q = String(query || "该视频").trim() || "该视频";
  return `「${q}」的视频暂未通过校验：大模型全网检索结果与平台抓取内容不一致。请换链接或补充更明确的描述。`;
}

const WEIXIN_VIDEO_HINT =
  /微信视频号|视频号解析|channels\.weixin|finder\.video|wxapp\.tc\.qq|weixin110\.qq|weixin\.qq\.com\/sph|元宝|yuanbao\.tencent/i;

const VIDEO_EXTRACT_HINT =
  /视频|channels\.weixin|finder\.video|wxapp\.tc\.qq|weixin110|weixin\.qq\.com|exportkey|分享链接|解析.*链接|douyin|bilibili|youtu|tiktok|v\.douyin|未找到可.*流|下载失败|无法解析该/i;

/**
 * 微信视频号提取失败：给出可操作的提示，不暴露 Cookie 路径或脚本命令
 * @param {string | null | undefined} raw
 */
export function formatWeixinChannelsError(raw) {
  const msg = String(raw ?? "").trim();
  if (!msg) {
    return "微信视频号解析失败。请粘贴从微信「复制链接」得到的完整分享文案后重试。";
  }
  if (/无法识别|微信公众号|mp\.weixin/i.test(msg)) return msg;
  if (/cookie|登录|元宝|未知错误|20000|鉴权|失效/i.test(msg)) {
    return "微信视频号解析需要登录腾讯元宝。请用 Safari 打开 yuanbao.tencent.com 并登录微信，然后重新提取；若仍失败，请粘贴完整的视频号分享链接（含 exportkey）。";
  }
  if (/exportkey|完整分享|分享页/i.test(msg)) {
    return "请粘贴从微信「复制链接」得到的完整视频号分享链接（长链接，含 exportkey），不要只粘贴短链。";
  }
  if (/未找到|解析失败|fetch failed|403|401|被拒绝/i.test(msg)) {
    return "未能解析该视频号链接。请确认链接未过期，并粘贴从微信复制的完整分享文案后重试。";
  }
  if (msg.length > 160) {
    return "微信视频号解析失败。请粘贴完整分享链接，并确保已在浏览器登录腾讯元宝（yuanbao.tencent.com）。";
  }
  return msg;
}

/**
 * 通用视频提取失败（避免误显示「该功能暂时不可用」）
 * @param {string | null | undefined} raw
 */
export function formatVideoExtractError(raw) {
  const msg = String(raw ?? "").trim();
  if (!msg) return "视频解析失败，请确认链接完整且未过期。";
  if (WEIXIN_VIDEO_HINT.test(msg) || /exportkey|视频号/i.test(msg)) {
    return formatWeixinChannelsError(msg);
  }
  if (/yt-dlp|cookies\/|未配置|环境变量|YTDLP|pip install|\.env|start\.sh/i.test(msg)) {
    return "视频解析暂时失败。若为微信视频号，请粘贴完整分享链接并在浏览器登录腾讯元宝（yuanbao.tencent.com）后重试。";
  }
  if (/douyin|抖音/i.test(msg)) {
    return "抖音视频解析失败，请粘贴完整分享链接后重试。";
  }
  if (/bilibili|B站|哔哩/i.test(msg)) {
    return "B 站视频解析失败，请粘贴 bilibili.com 或 b23.tv 链接。";
  }
  if (/无法解析|Unsupported URL|no video|403|401|502/i.test(msg)) {
    return "无法解析该视频链接，请确认链接完整、未过期，且内容为公开视频。";
  }
  return msg.length > 160 ? "视频解析失败，请换链接或稍后重试。" : msg;
}

/**
 * 资源搜索失败时，避免向用户暴露接口、网盘、屏蔽规则等内部细节
 * @param {string | null | undefined} raw
 * @param {string} [query]
 */
export function sanitizeMediaSearchError(raw, query) {
  const msg = String(raw ?? "").trim();
  if (/请输入|关键词过长|精简后再试/.test(msg)) return msg;
  return formatResourceNotFound(query);
}

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

  if (WEIXIN_VIDEO_HINT.test(msg)) {
    return formatWeixinChannelsError(msg);
  }

  if (VIDEO_EXTRACT_HINT.test(msg)) {
    return formatVideoExtractError(msg);
  }

  if (DEV_HINT.test(msg)) {
    if (VIDEO_EXTRACT_HINT.test(msg) || /yuanbao|YUANBAO|元宝|yt-dlp|YTDLP/i.test(msg)) {
      return formatVideoExtractError(msg);
    }
    return AI_HINT.test(msg) ? AI_SERVICE_UNAVAILABLE : FEATURE_UNAVAILABLE;
  }

  if (/请检查.*API Key|重启\s*\.\/start\.sh/i.test(msg)) {
    return AI_HINT.test(msg) ? AI_SERVICE_UNAVAILABLE : FEATURE_UNAVAILABLE;
  }

  return msg;
}
