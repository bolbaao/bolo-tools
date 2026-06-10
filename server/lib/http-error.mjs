import {
  formatVideoExtractError,
  formatWeixinChannelsError,
  toUserFacingErrorMessage,
} from "../../shared/public-error.mjs";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function sendError(res, err) {
  const status = err.status ?? 500;
  res.status(status).json({
    ok: false,
    error: toUserFacingErrorMessage(err.message || "服务器错误"),
  });
}

/** 视频提取/下载：优先返回可操作的解析提示 */
export function sendVideoError(res, err, platform, url = "") {
  const status = err.status ?? 500;
  const raw = err.message || "服务器错误";
  const hint = `${raw} ${url}`;
  let error;
  if (platform === "weixin-channels" || WEIXIN_URL.test(hint)) {
    error = formatWeixinChannelsError(raw);
  } else if (platform && platform !== "generic") {
    error = formatVideoExtractError(raw);
  } else if (VIDEO_URL.test(hint)) {
    error = formatVideoExtractError(raw);
  } else {
    error = toUserFacingErrorMessage(raw);
  }
  res.status(status).json({ ok: false, error });
}

const WEIXIN_URL =
  /channels\.weixin|finder\.video|wxapp\.tc\.qq|weixin110|weixin\.qq\.com\/(?:sph|r\/)/i;
const VIDEO_URL = /channels\.weixin|finder\.video|douyin|bilibili|youtu|tiktok|视频/i;
