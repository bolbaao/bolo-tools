const API_BASE = typeof window !== "undefined" ? "" : "http://127.0.0.1:3000";

/** 浏览器内请求 API / 代理下载的完整 URL */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export function apiNotFoundMessage(): string {
  return "未找到 API。请用 ./start.sh 启动，或开发时运行 npm run dev:all（或分别 npm run dev:api + npm run dev）";
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function extractErrorMessage(data: unknown, res: Response): string {
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (typeof o.error === "string" && o.error) return o.error;
    if (typeof o.message === "string" && o.message) return o.message;
  }
  if (res.status === 404) {
    return apiNotFoundMessage();
  }
  if (res.status >= 500) return `服务异常（${res.status}）`;
  if (res.statusText) return res.statusText;
  return "请求失败";
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (!res.ok) {
        throw new ApiError(
          res.status === 404 ? apiNotFoundMessage() : `服务返回非 JSON（${res.status}）`,
          res.status,
        );
      }
    }
  }
  if (!res.ok) {
    throw new ApiError(extractErrorMessage(data, res), res.status);
  }
  const body = data as { ok?: boolean; error?: string };
  if (body.ok === false && body.error) {
    throw new ApiError(body.error, res.status);
  }
  return data as T;
}

type FetchOpts = {
  credentials?: RequestCredentials;
  /** 超时毫秒数，超时后抛出 ApiError */
  timeoutMs?: number;
};

export async function apiPost<T>(
  path: string,
  body: unknown,
  opts?: FetchOpts,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (opts?.timeoutMs && opts.timeoutMs > 0) {
    timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: opts?.credentials,
      signal: controller.signal,
    });
    return parseJson<T>(res);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new ApiError("请求超时。大文件或网络较慢时请稍后重试，或在 .env 增大 DOC_CONVERT_TIMEOUT_MS", 408);
    }
    if (e instanceof TypeError) {
      throw new ApiError("无法连接本地服务，请确认已运行 ./start.sh", 0);
    }
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function apiGet<T>(path: string, opts?: FetchOpts): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: opts?.credentials,
  });
  return parseJson<T>(res);
}

export async function apiDelete<T>(path: string, opts?: FetchOpts): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    credentials: opts?.credentials,
  });
  return parseJson<T>(res);
}

export async function apiUpload<T>(
  path: string,
  formData: FormData,
  opts?: FetchOpts,
): Promise<T | Blob> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (opts?.timeoutMs && opts.timeoutMs > 0) {
    timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      body: formData,
      credentials: opts?.credentials,
      signal: controller.signal,
    });
    const type = res.headers.get("Content-Type") || "";
    if (type.includes("application/json")) {
      return parseJson<T>(res);
    }
    const { blob } = await readBinaryUploadResponse(res);
    return blob;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new ApiError("请求超时。大文件或网络较慢时请稍后重试，或在 .env 增大 DOC_CONVERT_TIMEOUT_MS", 408);
    }
    if (e instanceof TypeError) {
      throw new ApiError("无法连接本地服务，请确认已运行 ./start.sh", 0);
    }
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** 上传并下载二进制文件（带格式校验，避免把 JSON/HTML 当文档保存） */
export async function apiUploadBinary(
  path: string,
  formData: FormData,
  opts?: FetchOpts,
): Promise<{ blob: Blob; contentType: string; filename?: string }> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (opts?.timeoutMs && opts.timeoutMs > 0) {
    timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      body: formData,
      credentials: opts?.credentials,
      signal: controller.signal,
    });
    const type = res.headers.get("Content-Type") || "";
    if (type.includes("application/json")) {
      await parseJson<never>(res);
      throw new ApiError("未收到文件，服务返回了 JSON");
    }
    return readBinaryUploadResponse(res);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new ApiError("请求超时。大文件或网络较慢时请稍后重试，或在 .env 增大 DOC_CONVERT_TIMEOUT_MS", 408);
    }
    if (e instanceof TypeError) {
      throw new ApiError("无法连接本地服务，请确认已运行 ./start.sh", 0);
    }
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function readBinaryUploadResponse(res: Response): Promise<{
  blob: Blob;
  contentType: string;
  filename?: string;
}> {
  const type = res.headers.get("Content-Type") || "";

  if (!res.ok) {
    if (type.includes("application/json")) {
      await parseJson<never>(res);
    }
    const text = await res.text();
    let message = "上传失败";
    try {
      const data = JSON.parse(text) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        message = apiNotFoundMessage();
      } else if (text.trim()) {
        message = text.slice(0, 240);
      }
    }
    throw new ApiError(message, res.status);
  }

  const blob = await res.blob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const sniff = sniffDownloadError(bytes);
  if (sniff) {
    throw new ApiError(sniff, res.status);
  }

  const disposition = res.headers.get("Content-Disposition");
  return {
    blob: new Blob([bytes], { type: type.split(";")[0].trim() || "application/octet-stream" }),
    contentType: type.split(";")[0].trim(),
    filename: parseFilenameFromDisposition(disposition) ?? undefined,
  };
}

function parseFilenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      return utf8[1].trim();
    }
  }
  const plain = header.match(/filename="?([^";]+)"?/i);
  return plain?.[1]?.trim() ?? null;
}

function sniffDownloadError(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return "下载的文件为空";
  const head = new TextDecoder().decode(bytes.slice(0, Math.min(200, bytes.length)));
  const trimmed = head.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const j = JSON.parse(new TextDecoder().decode(bytes)) as { error?: string };
      return j.error || "转换失败（服务返回错误信息）";
    } catch {
      return "下载到的不是有效文档（疑似错误信息）";
    }
  }
  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    return apiNotFoundMessage();
  }
  return null;
}

const FILE_SIGNATURES: Record<string, number[][]> = {
  pdf: [[0x25, 0x50, 0x44, 0x46]],
  zip: [[0x50, 0x4b, 0x03, 0x04]],
  docx: [[0x50, 0x4b, 0x03, 0x04]],
};

export function assertFileSignature(bytes: Uint8Array, kind: "pdf" | "zip" | "docx") {
  const sigs = FILE_SIGNATURES[kind];
  const ok = sigs.some((sig) => sig.every((b, i) => bytes[i] === b));
  if (!ok) {
    throw new ApiError(`下载的文件不是有效的 ${kind.toUpperCase()}，请重试或检查服务是否已启动`);
  }
}

export function downloadBlob(blob: Blob, filename: string, mimeType?: string) {
  const file =
    mimeType && blob.type !== mimeType ? new Blob([blob], { type: mimeType }) : blob;
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** 带 UTF-8 BOM 的文本下载，避免 Windows 记事本中文乱码 */
export function downloadText(content: string, filename: string, mimeType = "text/plain;charset=utf-8") {
  const bom = "\uFEFF";
  downloadBlob(new Blob([bom + content], { type: mimeType }), filename);
}
