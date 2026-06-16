import { Agent, fetch as undiciFetch } from "undici";
import { env } from "./env.mjs";

function isProxyUnreachable(err) {
  const msg = String(err?.message || err || "");
  const cause = String(err?.cause?.message || err?.cause?.code || "");
  return /ECONNREFUSED|connect ECONNREFUSED|CONNECT response|proxy|socket hang up/i.test(`${msg} ${cause}`);
}

/** 代理未启动或不可达时，自动改走直连（不影响代理正常时的境外请求） */
export async function fetchWithProxyFallback(url, init = {}) {
  try {
    return await fetch(url, init);
  } catch (e) {
    const hasProxy = Boolean(env("HTTPS_PROXY") || env("HTTP_PROXY"));
    if (!hasProxy || !isProxyUnreachable(e)) throw e;
    return undiciFetch(url, { ...init, dispatcher: new Agent() });
  }
}
