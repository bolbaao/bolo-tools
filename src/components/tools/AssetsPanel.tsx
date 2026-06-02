"use client";

import {
  assetFileUrl,
  deleteAsset,
  formatSize,
  listAssets,
  logoutAssets,
  uploadAssets,
  type AssetItem,
} from "@/lib/assets";
import { ApiError } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const filters = ["全部", "image", "video", "audio"] as const;

export default function AssetsPanel() {
  const router = useRouter();
  const [items, setItems] = useState<AssetItem[]>([]);
  const [filter, setFilter] = useState<(typeof filters)[number]>("全部");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listAssets();
      setItems(list);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = items.filter((item) => {
    if (filter !== "全部" && item.kind !== filter) return false;
    if (search.trim() && !item.name.toLowerCase().includes(search.trim().toLowerCase())) {
      return false;
    }
    return true;
  });

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      await uploadAssets(Array.from(files));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "上传失败");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("确定删除该素材？")) return;
    try {
      await deleteAsset(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "删除失败");
    }
  };

  const onLogout = async () => {
    await logoutAssets();
    router.push("/");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white/40">
          共 {items.length} 项 · 你的专属素材库
        </p>
        <button
          type="button"
          onClick={() => void onLogout()}
          className="text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          退出登录
        </button>
      </div>

      <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-8 cursor-pointer hover:border-blue-500/35 hover:bg-blue-500/5 transition-all">
        <span className="text-2xl opacity-60">▣</span>
        <span className="text-sm text-white/50">
          {uploading ? "上传中…" : "点击上传图片 / 视频 / 音频"}
        </span>
        <span className="text-xs text-white/25">单文件最大 100MB · 一次最多 20 个</span>
        <input
          type="file"
          accept="image/*,video/*,audio/*"
          multiple
          className="hidden"
          disabled={uploading}
          onChange={(e) => void onUpload(e)}
        />
      </label>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索素材名称…"
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
        />
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                filter === f
                  ? "bg-blue-500/20 text-blue-200 ring-1 ring-blue-500/30"
                  : "bg-white/5 text-white/45 ring-1 ring-white/8"
              }`}
            >
              {f === "全部" ? "全部" : f === "image" ? "图片" : f === "video" ? "视频" : "音频"}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-400/90 text-center">{error}</p>}

      {loading ? (
        <p className="text-center text-sm text-white/35 py-12">加载中…</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-white/35 py-12">暂无素材</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {filtered.map((item) => (
            <li key={item.id} className="bento-card overflow-hidden">
              <div className="aspect-video bg-black/40 relative flex items-center justify-center">
                {item.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={assetFileUrl(item.storedName)}
                    alt={item.name}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : item.kind === "video" ? (
                  <video
                    src={assetFileUrl(item.storedName)}
                    className="max-h-full max-w-full"
                    controls
                    preload="metadata"
                  />
                ) : item.kind === "audio" ? (
                  <audio src={assetFileUrl(item.storedName)} controls className="w-full px-4" />
                ) : (
                  <span className="text-3xl text-white/20">📄</span>
                )}
              </div>
              <div className="p-4">
                <p className="text-sm font-medium text-white/85 truncate">{item.name}</p>
                <p className="mt-1 text-xs text-white/35">
                  {formatSize(item.size)} · {new Date(item.uploadedAt).toLocaleString("zh-CN")}
                </p>
                <div className="mt-3 flex gap-2">
                  <a
                    href={assetFileUrl(item.storedName)}
                    download={item.name}
                    className="rounded-lg px-3 py-1.5 text-xs text-blue-300 ring-1 ring-blue-500/25 hover:bg-blue-500/10"
                  >
                    下载
                  </a>
                  <button
                    type="button"
                    onClick={() => void onDelete(item.id)}
                    className="rounded-lg px-3 py-1.5 text-xs text-red-300/80 ring-1 ring-red-500/20 hover:bg-red-500/10"
                  >
                    删除
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
