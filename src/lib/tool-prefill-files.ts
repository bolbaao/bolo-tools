const DB_NAME = "pineapple-tool-files";
const DB_VERSION = 1;
const STORE = "prefill";
const TTL_MS = 120_000;

type StoredFileMeta = {
  name: string;
  type: string;
  lastModified: number;
};

type StoredPayload = {
  toolId: string;
  ts: number;
  metas: StoredFileMeta[];
  blobs: Blob[];
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("无法打开文件缓存"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });
}

function storageKey(toolId: string) {
  return `tool:${toolId}`;
}

function blobsToFiles(metas: StoredFileMeta[], blobs: Blob[]): File[] {
  return metas.map((meta, i) => {
    const blob = blobs[i];
    return new File([blob], meta.name, {
      type: meta.type || blob.type || "application/octet-stream",
      lastModified: meta.lastModified,
    });
  });
}

/** 跳转工具页前写入待处理文件（跨页最可靠） */
export async function saveToolPrefillFiles(toolId: string, files: File[]): Promise<void> {
  if (typeof window === "undefined" || !files.length) return;

  const payload: StoredPayload = {
    toolId,
    ts: Date.now(),
    metas: files.map((f) => ({ name: f.name, type: f.type, lastModified: f.lastModified })),
    blobs: files.map((f) => new Blob([f], { type: f.type || "application/octet-stream" })),
  };

  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("写入文件缓存失败"));
      tx.objectStore(STORE).put(payload, storageKey(toolId));
    });
  } finally {
    db.close();
  }
}

async function readPayload(toolId: string, remove: boolean): Promise<StoredPayload | null> {
  if (typeof window === "undefined") return null;

  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    return null;
  }

  try {
    const payload = await new Promise<StoredPayload | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const req = store.get(storageKey(toolId));
      req.onsuccess = () => {
        const data = (req.result as StoredPayload | undefined) ?? null;
        if (remove && data) store.delete(storageKey(toolId));
        resolve(data);
      };
      req.onerror = () => reject(req.error ?? new Error("读取文件缓存失败"));
    });

    if (!payload || payload.toolId !== toolId) return null;
    if (Date.now() - payload.ts > TTL_MS) {
      await clearToolPrefillFiles(toolId);
      return null;
    }
    if (payload.metas.length !== payload.blobs.length) return null;
    return payload;
  } catch {
    return null;
  } finally {
    db.close();
  }
}

/** 读取待处理文件但不删除（用于 Strict Mode 重试） */
export async function peekToolPrefillFiles(toolId: string): Promise<File[] | null> {
  const payload = await readPayload(toolId, false);
  if (!payload) return null;
  return blobsToFiles(payload.metas, payload.blobs);
}

/** 读取并清除待处理文件 */
export async function consumeToolPrefillFiles(toolId: string): Promise<File[] | null> {
  const payload = await readPayload(toolId, true);
  if (!payload) return null;
  return blobsToFiles(payload.metas, payload.blobs);
}

export async function clearToolPrefillFiles(toolId: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE).delete(storageKey(toolId));
    });
    db.close();
  } catch {
    /* ignore */
  }
}

/** Agent / 首页跳转：在 prefill 到这些工具前保存附件 */
export const TOOL_PREFILL_FILE_IDS = new Set([
  "doc-convert",
  "music-convert",
  "gif-maker",
  "subtitle-workshop",
  "image-studio",
]);

export function toolPrefillAcceptsFiles(toolId: string): boolean {
  return TOOL_PREFILL_FILE_IDS.has(toolId);
}
