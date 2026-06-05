import { apiDelete, apiGet, apiUpload, ApiError } from "@/lib/api";

export type HomeBackgroundInfo = {
  configured: boolean;
  videoUrl: string | null;
  name?: string;
  mime?: string;
  size?: number;
  updatedAt?: string;
};

const cred = { credentials: "include" as const };

export async function fetchHomeBackground(): Promise<HomeBackgroundInfo> {
  const data = await apiGet<{
    ok: boolean;
    configured: boolean;
    videoUrl: string | null;
    name?: string;
    mime?: string;
    size?: number;
    updatedAt?: string;
  }>("/api/home-background", cred);
  return {
    configured: data.configured,
    videoUrl: data.videoUrl,
    name: data.name,
    mime: data.mime,
    size: data.size,
    updatedAt: data.updatedAt,
  };
}

export async function uploadHomeBackground(file: File): Promise<HomeBackgroundInfo> {
  const form = new FormData();
  form.append("video", file);
  const data = await apiUpload<{
    ok: boolean;
    configured: boolean;
    videoUrl: string | null;
    name?: string;
  }>("/api/home-background", form, { ...cred, timeoutMs: 120_000 });
  if (!data || typeof data !== "object" || !("configured" in data)) {
    throw new ApiError("上传失败");
  }
  return {
    configured: data.configured,
    videoUrl: data.videoUrl,
    name: data.name,
  };
}

export async function removeHomeBackground(): Promise<void> {
  await apiDelete("/api/home-background", cred);
}

export const HOME_BG_LOCAL_KEY = "pineapple-home-bg-local";

const DB_NAME = "pineapple-home-bg";
const STORE = "video";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });
}

export async function loadLocalHomeBackground(): Promise<string | null> {
  if (typeof window === "undefined" || !window.indexedDB) return null;
  try {
    const db = await openDb();
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const getReq = tx.objectStore(STORE).get("current");
      getReq.onsuccess = () => resolve((getReq.result as Blob) ?? null);
      getReq.onerror = () => reject(getReq.error);
    });
    db.close();
    if (!blob || !blob.type.startsWith("video/")) return null;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export async function saveLocalHomeBackground(file: File): Promise<string> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(file, "current");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  localStorage.setItem(HOME_BG_LOCAL_KEY, "1");
  return URL.createObjectURL(file);
}

export async function clearLocalHomeBackground(): Promise<void> {
  if (typeof window === "undefined" || !window.indexedDB) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete("current");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* ignore */
  }
  localStorage.removeItem(HOME_BG_LOCAL_KEY);
}
