"use client";

import {
  adminMediaFileUrl,
  getAdminUserArchive,
  listAdminMedia,
  listAdminUsers,
  setAdminMediaSaved,
  type AdminMediaItem,
  type AdminMemoryItem,
  type AdminUserSummary,
} from "@/lib/admin";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";

type Tab = "users" | "media";

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const SOURCE_LABELS: Record<string, string> = {
  chat: "对话上传",
  "home-background": "首页背景",
  "mlsharp-3d": "3D 工坊",
  "gif-maker": "GIF 动图",
  "subtitle-extract": "字幕提取",
  "subtitle-transcribe": "字幕转写",
  "ai-video-edit": "AI 视频剪辑",
  unknown: "其他",
};

function sourceLabel(source: string) {
  return SOURCE_LABELS[source] || source;
}

function AdminMediaLibrary() {
  const [items, setItems] = useState<AdminMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<"" | "image" | "video">("");
  const [savedFilter, setSavedFilter] = useState<"" | "saved" | "unsaved">("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listAdminMedia({
        kind: kindFilter || undefined,
        saved: savedFilter === "saved" ? true : savedFilter === "unsaved" ? false : undefined,
      });
      setItems(list);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载媒体库失败");
    } finally {
      setLoading(false);
    }
  }, [kindFilter, savedFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = async (item: AdminMediaItem) => {
    if (item.saved) return;
    setSavingId(item.id);
    setError(null);
    try {
      const updated = await setAdminMediaSaved(item.id, true);
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "保存失败");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white/45">
          用户上传的图片与视频 · 未保存项 2 天后自动清理
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          刷新
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["", "image", "video"] as const).map((k) => (
          <button
            key={k || "all"}
            type="button"
            onClick={() => setKindFilter(k)}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              kindFilter === k
                ? "bg-white/15 text-white/90"
                : "bg-white/[0.04] text-white/45 hover:text-white/70"
            }`}
          >
            {k === "" ? "全部类型" : k === "image" ? "图片" : "视频"}
          </button>
        ))}
        {(["", "unsaved", "saved"] as const).map((s) => (
          <button
            key={s || "all-status"}
            type="button"
            onClick={() => setSavedFilter(s)}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              savedFilter === s
                ? "bg-amber-500/20 text-amber-200/90"
                : "bg-white/[0.04] text-white/45 hover:text-white/70"
            }`}
          >
            {s === "" ? "全部状态" : s === "saved" ? "已保存" : "待清理"}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-center text-sm text-white/40 py-12">加载中…</p>
      ) : items.length === 0 ? (
        <p className="text-center text-sm text-white/35 py-12">暂无媒体文件</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]"
            >
              <div className="relative aspect-video bg-black/40">
                {item.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={adminMediaFileUrl(item.id)}
                    alt={item.name}
                    className="h-full w-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <video
                    src={adminMediaFileUrl(item.id)}
                    className="h-full w-full object-contain"
                    controls
                    preload="metadata"
                  />
                )}
                {item.saved ? (
                  <span className="absolute right-2 top-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-200/90">
                    已保存
                  </span>
                ) : (
                  <span className="absolute right-2 top-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-200/90">
                    待清理
                  </span>
                )}
              </div>
              <div className="space-y-2 p-3">
                <p className="truncate text-sm text-white/80" title={item.name}>
                  {item.name}
                </p>
                <p className="text-xs text-white/40">
                  {item.username} · {formatSize(item.size)} · {sourceLabel(item.source)}
                </p>
                <p className="text-xs text-white/35">
                  上传 {formatDate(item.uploadedAt)}
                  {!item.saved && item.expiresAt ? (
                    <> · 清理于 {formatDate(item.expiresAt)}</>
                  ) : null}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <a
                    href={adminMediaFileUrl(item.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-white/50 hover:text-white/80 transition-colors"
                  >
                    打开
                  </a>
                  {!item.saved ? (
                    <button
                      type="button"
                      disabled={savingId === item.id}
                      onClick={() => void onSave(item)}
                      className="ml-auto rounded-full bg-amber-500/20 px-3 py-1 text-xs text-amber-200/90 hover:bg-amber-500/30 disabled:opacity-50 transition-colors"
                    >
                      {savingId === item.id ? "保存中…" : "保存"}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminPanel() {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [memories, setMemories] = useState<AdminMemoryItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await listAdminUsers());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载用户列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.isAdmin) void loadUsers();
  }, [user?.isAdmin, loadUsers]);

  const selectUser = async (userId: string) => {
    if (selectedId === userId) {
      setSelectedId(null);
      setMemories([]);
      return;
    }
    setSelectedId(userId);
    setDetailLoading(true);
    try {
      const data = await getAdminUserArchive(userId);
      setMemories(data.memories);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载用户存档失败");
    } finally {
      setDetailLoading(false);
    }
  };

  if (authLoading) {
    return <p className="text-center text-sm text-white/40 py-20">验证登录状态…</p>;
  }

  if (!user?.isAdmin) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-white/50">需要管理员账号才能访问</p>
        <p className="text-xs text-white/30">请使用管理员账号登录</p>
        <Link
          href="/"
          className="inline-flex rounded-full bg-white/10 px-5 py-2 text-sm text-white/80 hover:bg-white/15"
        >
          返回首页
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white/45">管理员视图 · 用户与媒体管理</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("users")}
            className={`rounded-full px-4 py-1.5 text-xs transition-colors ${
              tab === "users"
                ? "bg-white/15 text-white/90"
                : "bg-white/[0.04] text-white/45 hover:text-white/70"
            }`}
          >
            用户
          </button>
          <button
            type="button"
            onClick={() => setTab("media")}
            className={`rounded-full px-4 py-1.5 text-xs transition-colors ${
              tab === "media"
                ? "bg-white/15 text-white/90"
                : "bg-white/[0.04] text-white/45 hover:text-white/70"
            }`}
          >
            媒体库
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {tab === "media" ? (
        <AdminMediaLibrary />
      ) : loading ? (
        <p className="text-center text-sm text-white/40 py-12">加载中…</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-white/70">注册用户 ({users.length})</h2>
            <button
              type="button"
              onClick={() => void loadUsers()}
              className="text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              刷新
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] text-xs text-white/40">
                  <th className="px-4 py-3 font-medium">用户名</th>
                  <th className="px-4 py-3 font-medium">邮箱</th>
                  <th className="px-4 py-3 font-medium">注册时间</th>
                  <th className="px-4 py-3 font-medium">记忆</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <Fragment key={u.id}>
                    <tr
                      className={`border-b border-white/[0.05] cursor-pointer transition-colors ${
                        selectedId === u.id ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                      }`}
                      onClick={() => void selectUser(u.id)}
                    >
                      <td className="px-4 py-3 text-white/85">
                        {u.username}
                        {u.isAdmin && (
                          <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300/90">
                            管理员
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white/50">{u.email || "—"}</td>
                      <td className="px-4 py-3 text-white/45 text-xs">{formatDate(u.createdAt)}</td>
                      <td className="px-4 py-3 text-white/55">{u.memoryCount}</td>
                      <td className="px-4 py-3 text-xs">
                        {u.emailVerified ? (
                          <span className="text-emerald-400/80">已验证</span>
                        ) : (
                          <span className="text-amber-400/80">未验证</span>
                        )}
                      </td>
                    </tr>
                    {selectedId === u.id && (
                      <tr>
                        <td colSpan={5} className="px-4 py-4 bg-white/[0.02]">
                          {detailLoading ? (
                            <p className="text-xs text-white/40">加载存档…</p>
                          ) : (
                            <div>
                              <h3 className="text-xs font-medium text-white/55 mb-3">
                                记忆库 ({memories.length})
                              </h3>
                              {memories.length === 0 ? (
                                <p className="text-xs text-white/30">暂无记忆</p>
                              ) : (
                                <ul className="space-y-2 max-h-64 overflow-y-auto">
                                  {memories.map((m) => (
                                    <li
                                      key={m.id}
                                      className="rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-white/70"
                                    >
                                      <p className="whitespace-pre-wrap">{m.content}</p>
                                      <p className="mt-1 text-white/30">
                                        {m.source === "auto" ? "自动" : "手动"} · {formatDate(m.updatedAt)}
                                      </p>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
