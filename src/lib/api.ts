const API_BASE = typeof window !== "undefined" ? "" : "http://127.0.0.1:3000";

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
    return "未找到 API。请用 ./start.sh 启动（若用 npm run dev，需另开终端运行 npm run dev:api）";
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
          res.status === 404
            ? "未找到 API。请用 ./start.sh 启动"
            : `服务返回非 JSON（${res.status}）`,
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
      throw new ApiError("请求超时，请稍后重试", 408);
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
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    body: formData,
    credentials: opts?.credentials,
  });
  const type = res.headers.get("Content-Type") || "";
  if (type.includes("application/json")) {
    return parseJson<T>(res);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError((data as { error?: string }).error || "上传失败", res.status);
  }
  return res.blob();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
