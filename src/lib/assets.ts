import { apiDelete, apiGet, apiPost, apiUpload, ApiError } from "@/lib/api";

export type AssetItem = {
  id: string;
  storedName: string;
  name: string;
  mime: string;
  size: number;
  kind: "image" | "video" | "audio" | "file";
  uploadedAt: string;
};

const cred = { credentials: "include" as const };

export async function checkAssetsSession() {
  const data = await apiGet<{ ok: boolean; authenticated: boolean }>(
    "/api/assets/session",
    cred,
  );
  return data.authenticated;
}

export async function loginAssets(password: string) {
  await apiPost("/api/assets/login", { password }, cred);
}

export async function logoutAssets() {
  await apiPost("/api/assets/logout", {}, cred);
}

export async function listAssets() {
  const data = await apiGet<{ ok: boolean; items: AssetItem[] }>(
    "/api/assets/list",
    cred,
  );
  return data.items;
}

export async function uploadAssets(files: File[]) {
  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  const data = await apiUpload<{ ok: boolean; items: AssetItem[] }>(
    "/api/assets/upload",
    fd,
    cred,
  );
  if (!(data instanceof Blob) && data.items) return data.items;
  throw new ApiError("上传失败");
}

export async function deleteAsset(id: string) {
  await apiDelete(`/api/assets/item/${id}`, cred);
}

export function assetFileUrl(storedName: string) {
  return `/api/assets/file/${encodeURIComponent(storedName)}`;
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

