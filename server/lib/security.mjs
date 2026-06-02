import { env } from "./env.mjs";
import { getAuthUserFromRequest, requireUserAuth } from "./user-auth.mjs";

const WEAK_SECRETS = new Set([
  "pineapple-user-dev",
  "pineapple-dev",
  "123456",
  "pineapple",
]);

/** 服务监听非本机地址（如 HOST=0.0.0.0）时为 true */
export function isPublicBind() {
  const host = (process.env.HOST || "127.0.0.1").trim().toLowerCase();
  return host === "0.0.0.0" || host === "::";
}

export function allowPublicApi() {
  const v = env("ALLOW_PUBLIC_API");
  return v === "1" || v === "true";
}

/** 启动时校验：公网/生产环境须配置强密钥 */
export function validateSecurityConfig() {
  const isProd = process.env.NODE_ENV === "production";
  const publicBind = isPublicBind();
  if (!isProd && !publicBind) return;

  const problems = [];

  const userSecret = env("USER_SESSION_SECRET") || env("ASSETS_SESSION_SECRET");
  if (!userSecret || WEAK_SECRETS.has(userSecret)) {
    problems.push("请设置强随机 USER_SESSION_SECRET（勿用默认值）");
  }

  const assetsPass = env("ASSETS_PASSWORD");
  if (!assetsPass || WEAK_SECRETS.has(assetsPass)) {
    problems.push("请设置 ASSETS_PASSWORD（勿用默认 pineapple）");
  }

  const adminPass = env("ADMIN_PASSWORD", "123456");
  if (adminPass === "123456") {
    problems.push("请修改 ADMIN_PASSWORD（勿用默认 123456）");
  }

  if (publicBind && !allowPublicApi()) {
    console.warn(
      "⚠️  服务监听公网地址但未设置 ALLOW_PUBLIC_API=1；高成本 API 将要求登录",
    );
  }

  if (problems.length) {
    const msg = `安全配置不足：\n  - ${problems.join("\n  - ")}`;
    if (isProd) {
      throw new Error(msg);
    }
    console.warn(`⚠️  ${msg}`);
  }
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.trim()) {
    return fwd.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

function createRateLimiter({ windowMs, max, message }) {
  const buckets = new Map();

  return (req, res, next) => {
    const key = clientIp(req);
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      res.status(429).json({ ok: false, error: message });
      return;
    }
    next();
  };
}

/** 登录 / 验证码 / 素材库登录 */
export const authRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  message: "请求过于频繁，请稍后再试",
});

/** 通用 API */
export const apiRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: 120,
  message: "请求过于频繁，请稍后再试",
});

/** AI / 媒体处理等高成本接口 */
export const heavyApiRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: 40,
  message: "操作过于频繁，请稍后再试",
});

/**
 * 本机绑定（127.0.0.1）时允许匿名使用工具；
 * 公网绑定时要求登录，除非显式 ALLOW_PUBLIC_API=1。
 */
export function requireAuthIfPublic(req, res, next) {
  if (!isPublicBind() || allowPublicApi()) {
    next();
    return;
  }
  requireUserAuth(req, res, next);
}

/** 社媒发布等敏感操作：本机也须管理员登录 */
export function requireAdminAlways(req, res, next) {
  const user = getAuthUserFromRequest(req);
  if (!user?.isAdmin) {
    res.status(403).json({ ok: false, error: "需要管理员权限" });
    return;
  }
  req.user = user;
  next();
}
