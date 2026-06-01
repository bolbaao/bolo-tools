"use client";

import { useAuth } from "@/contexts/AuthContext";
import AuthModal from "@/components/AuthModal";
import { ApiError } from "@/lib/api";
import {
  addMemory,
  deleteMemory,
  listMemories,
  updateMemory,
  type MemoryItem,
} from "@/lib/memory";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function MemoryPanel() {
  const { user, loading: authLoading } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user?.emailVerified) return;
    setLoading(true);
    setError(null);
    try {
      setItems(await listMemories());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [user?.emailVerified]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const item = await addMemory(text);
      setItems((prev) => [item, ...prev]);
      setDraft("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "添加失败");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async (id: string) => {
    const text = editText.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const item = await updateMemory(id, text);
      setItems((prev) => prev.map((m) => (m.id === id ? item : m)));
      setEditingId(null);
      setEditText("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteMemory(id);
      setItems((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "删除失败");
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) {
    return <p className="text-sm text-white/40">加载中…</p>;
  }

  if (!user) {
    return (
      <>
        <div className="bento-card p-8 text-center">
          <p className="text-white/70 text-sm leading-relaxed">
            登录后可创建专属记忆库，保存偏好、习惯与重要信息；AI 对话会自动参考这些记忆。
          </p>
          <button
            type="button"
            onClick={() => setAuthOpen(true)}
            className="mt-6 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-2.5 text-sm font-medium text-white hover:brightness-110 transition-all"
          >
            登录 / 注册
          </button>
        </div>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      </>
    );
  }

  if (!user.emailVerified) {
    return (
      <div className="bento-card p-8 text-center space-y-3">
        <p className="text-sm text-white/70 leading-relaxed">
          请先验证邮箱 <span className="text-white">{user.email}</span>，验证后可管理记忆库并使用自动记忆提取。
        </p>
        <p className="text-xs text-white/40">可在页面顶部重新发送验证邮件。</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/45 leading-relaxed">
        你好，<span className="text-white/70">{user.username}</span>
        。这里保存的信息会在{" "}
        <Link href="/tools/ai-chat" className="text-emerald-400/80 hover:text-emerald-300">
          AI 对话
        </Link>{" "}
        中自动生效，让回复更贴合你。
      </p>

      <div className="bento-card p-4 sm:p-5 space-y-3">
        <label className="block text-xs text-white/40">添加新记忆</label>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="例如：我喜欢简洁的回答；我是前端开发者；对海鲜过敏…"
          rows={3}
          maxLength={2000}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-emerald-500/40 resize-none"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] text-white/30">{draft.length}/2000</span>
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={busy || !draft.trim()}
            className="rounded-full bg-white px-5 py-2 text-sm font-medium text-[#0a0b14] disabled:opacity-40 hover:bg-white/92 transition-colors"
          >
            保存到记忆库
          </button>
        </div>
      </div>

      {error && <p className="text-center text-xs text-red-400/80">{error}</p>}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white/70">我的记忆</h3>
          <span className="text-xs text-white/30">{items.length} 条</span>
        </div>

        {loading ? (
          <p className="text-xs text-white/30 py-6 text-center">加载中…</p>
        ) : items.length === 0 ? (
          <div className="bento-card p-8 text-center">
            <p className="text-sm text-white/35">还没有记忆，添加第一条吧</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="bento-card p-4">
                {editingId === item.id ? (
                  <div className="space-y-3">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                      maxLength={2000}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/40 resize-none"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditText("");
                        }}
                        className="text-xs text-white/40 hover:text-white/60"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSaveEdit(item.id)}
                        disabled={busy || !editText.trim()}
                        className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-40"
                      >
                        保存
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-white/85 whitespace-pre-wrap leading-relaxed">
                      {item.content}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/30">
                          更新于 {formatDate(item.updatedAt)}
                        </span>
                        {item.source === "auto" && (
                          <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] text-violet-300/80">
                            自动提取
                          </span>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(item.id);
                            setEditText(item.content);
                          }}
                          className="text-xs text-white/40 hover:text-white/65"
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(item.id)}
                          disabled={busy}
                          className="text-xs text-red-400/70 hover:text-red-400 disabled:opacity-40"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
