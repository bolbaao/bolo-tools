import { toUserFacingErrorMessage } from "../../shared/public-error.mjs";

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
