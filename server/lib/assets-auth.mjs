import crypto from "crypto";
import { env } from "./env.mjs";

const COOKIE_NAME = "assets_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 7;

function secret() {
  return env("ASSETS_SESSION_SECRET") || env("ASSETS_PASSWORD") || "pineapple-dev";
}

export function getAssetsPassword() {
  const p = env("ASSETS_PASSWORD");
  if (!p) {
    console.warn("⚠️  未设置 ASSETS_PASSWORD，素材库使用默认密码: pineapple（请在 .env 中修改）");
    return "pineapple";
  }
  return p;
}

export function createSessionToken() {
  const exp = Date.now() + MAX_AGE_SEC * 1000;
  const payload = String(exp);
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token) {
  if (!token || !token.includes(".")) return false;
  const [payload, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const exp = Number(payload);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  return true;
}

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k) out[k] = decodeURIComponent(v.join("="));
  }
  return out;
}

export function getSessionFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[COOKIE_NAME] || "";
}

export function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${MAX_AGE_SEC}${secure}`,
  );
}

export function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`,
  );
}

export function requireAssetsAuth(req, res, next) {
  const token = getSessionFromRequest(req);
  if (!verifySessionToken(token)) {
    res.status(401).json({ ok: false, error: "未登录素材库" });
    return;
  }
  next();
}
