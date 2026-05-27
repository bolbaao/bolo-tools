import { HttpError } from "./http-error.mjs";
import { env } from "./env.mjs";

const CONVERT_API_BASE = "https://v2.convertapi.com";

function convertTimeoutMs() {
  const n = Number(env("DOC_CONVERT_TIMEOUT_MS", "300000"));
  return Number.isFinite(n) && n > 0 ? n : 300000;
}

async function fetchWithTimeout(url, init = {}, label = "请求") {
  const ms = convertTimeoutMs();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new HttpError(
        504,
        `${label}超时（${Math.round(ms / 1000)} 秒）。文件较大或网络较慢时可重试，或在 .env 设置 DOC_CONVERT_TIMEOUT_MS`,
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export function isOnlineDocConvertAvailable() {
  return Boolean(env("CONVERTAPI_SECRET"));
}

function mimeForExt(ext) {
  const e = ext.replace(/^\./, "").toLowerCase();
  const map = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
  };
  return map[e] || "application/octet-stream";
}

/**
 * 通过 ConvertAPI 云端转换（需 .env 配置 CONVERTAPI_SECRET）
 * @see https://www.convertapi.com/doc
 */
export async function convertViaConvertApi(buffer, fromExt, toExt, originalName = "source") {
  const secret = env("CONVERTAPI_SECRET");
  if (!secret) {
    throw new HttpError(
      503,
      "未配置云端文档转换。请在 .env 设置 CONVERTAPI_SECRET（免费注册 https://www.convertapi.com）",
    );
  }

  const from = fromExt.replace(/^\./, "").toLowerCase();
  const to = toExt.replace(/^\./, "").toLowerCase();
  const url = `${CONVERT_API_BASE}/convert/${from}/to/${to}?Secret=${encodeURIComponent(secret)}`;

  const form = new FormData();
  const safeName = originalName?.includes(".")
    ? originalName
    : `${originalName || "source"}.${from}`;
  form.append("File", new Blob([buffer], { type: mimeForExt(from) }), safeName);
  form.append("StoreFile", "false");

  let data;
  try {
    const res = await fetchWithTimeout(
      url,
      { method: "POST", body: form },
      "云端转换上传",
    );
    data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        (data && typeof data === "object" && (data.Message || data.message)) ||
        `云端转换失败（HTTP ${res.status}）`;
      throw new HttpError(res.status >= 500 ? 502 : 422, String(msg).slice(0, 240));
    }
  } catch (e) {
    if (e instanceof HttpError) throw e;
    const hint =
      /fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(e?.message || "")
        ? "。国内网络可尝试在 .env 配置 HTTPS_PROXY"
        : "";
    throw new HttpError(502, `无法连接云端转换服务：${(e.message || String(e)).slice(0, 100)}${hint}`);
  }

  const file = data?.Files?.[0];
  if (!file) {
    throw new HttpError(422, "云端转换未返回文件");
  }

  if (file.FileData) {
    return Buffer.from(file.FileData, "base64");
  }

  if (file.Url) {
    const dl = await fetchWithTimeout(file.Url, {}, "下载转换结果");
    if (!dl.ok) {
      throw new HttpError(502, "下载云端转换结果失败");
    }
    return Buffer.from(await dl.arrayBuffer());
  }

  throw new HttpError(422, "云端转换结果格式异常");
}
