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

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { error?: string }).error || res.statusText || "请求失败";
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

type FetchOpts = { credentials?: RequestCredentials };

export async function apiPost<T>(
  path: string,
  body: unknown,
  opts?: FetchOpts,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: opts?.credentials,
  });
  return parseJson<T>(res);
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
