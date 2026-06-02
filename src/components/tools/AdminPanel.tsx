"use client";

import {
  getAdminChatSession,
  getAdminUserArchive,
  listAdminUsers,
  type AdminChatSessionSummary,
  type AdminMemoryItem,
  type AdminUserSummary,
} from "@/lib/admin";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";

function formatDate(iso?: string) {
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

export default function AdminPanel() {
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [memories, setMemories] = useState<AdminMemoryItem[]>([]);
  const [sessions, setSessions] = useState<AdminChatSessionSummary[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [sessionMessages, setSessionMessages] = useState<
    { role: "user" | "ai"; text: string; createdAt: string }[] | null
  >(null);
  const [sessionLoading, setSessionLoading] = useState(false);

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
      setSessions([]);
      setExpandedSessionId(null);
      setSessionMessages(null);
      return;
    }
    setSelectedId(userId);
    setDetailLoading(true);
    setExpandedSessionId(null);
    setSessionMessages(null);
    try {
      const data = await getAdminUserArchive(userId);
      setMemories(data.memories);
      setSessions(data.chatSessions);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载用户存档失败");
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleSession = async (sessionId: string) => {
    if (!selectedId) return;
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      setSessionMessages(null);
      return;
    }
    setExpandedSessionId(sessionId);
    setSessionLoading(true);
    setSessionMessages(null);
    try {
      const session = await getAdminChatSession(selectedId, sessionId);
      setSessionMessages(session.messages);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载对话失败");
    } finally {
      setSessionLoading(false);
    }
  };

  if (authLoading) {
    return <p className="text-center text-sm text-white/40 py-20">验证登录状态…</p>;
  }

  if (!user?.isAdmin) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-white/50">需要管理员账号才能访问</p>
        <p className="text-xs text-white/30">默认账号 bolo / 123456（由 start.sh 自动创建）</p>
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
      <p className="text-sm text-white/45">
        管理员视图 · 可查看所有注册用户及其记忆库与对话存档
      </p>

      {error && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-center text-sm text-white/40 py-12">加载中…</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-white/70">
              注册用户 ({users.length})
            </h2>
            <button
              type="button"
              onClick={() => void loadUsers()}
              className="text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              刷新
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] text-xs text-white/40">
                  <th className="px-4 py-3 font-medium">用户名</th>
                  <th className="px-4 py-3 font-medium">邮箱</th>
                  <th className="px-4 py-3 font-medium">注册时间</th>
                  <th className="px-4 py-3 font-medium">记忆</th>
                  <th className="px-4 py-3 font-medium">对话</th>
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
                      <td className="px-4 py-3 text-white/55">{u.chatSessionCount}</td>
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
                        <td colSpan={6} className="px-4 py-4 bg-white/[0.02]">
                          {detailLoading ? (
                            <p className="text-xs text-white/40">加载存档…</p>
                          ) : (
                            <div className="grid gap-6 lg:grid-cols-2">
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
                                          {m.source === "auto" ? "自动" : "手动"} ·{" "}
                                          {formatDate(m.updatedAt)}
                                        </p>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                              <div>
                                <h3 className="text-xs font-medium text-white/55 mb-3">
                                  对话存档 ({sessions.length})
                                </h3>
                                {sessions.length === 0 ? (
                                  <p className="text-xs text-white/30">暂无对话</p>
                                ) : (
                                  <ul className="space-y-2 max-h-64 overflow-y-auto">
                                    {sessions.map((s) => (
                                      <li key={s.id}>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            void toggleSession(s.id);
                                          }}
                                          className="w-full rounded-lg bg-white/[0.04] px-3 py-2 text-left text-xs text-white/70 hover:bg-white/[0.07] transition-colors"
                                        >
                                          <span className="font-medium text-white/85">{s.title}</span>
                                          <span className="ml-2 text-white/35">
                                            {s.messageCount} 条 · {formatDate(s.updatedAt)}
                                          </span>
                                        </button>
                                        {expandedSessionId === s.id && (
                                          <div className="mt-2 ml-2 border-l border-white/10 pl-3 space-y-2">
                                            {sessionLoading ? (
                                              <p className="text-xs text-white/30">加载中…</p>
                                            ) : sessionMessages?.length ? (
                                              sessionMessages.map((msg, i) => (
                                                <div
                                                  key={i}
                                                  className={`text-xs rounded-lg px-2 py-1.5 ${
                                                    msg.role === "user"
                                                      ? "bg-blue-500/10 text-blue-100/80"
                                                      : "bg-white/[0.04] text-white/65"
                                                  }`}
                                                >
                                                  <span className="text-white/35 mr-1">
                                                    {msg.role === "user" ? "用户" : "AI"}:
                                                  </span>
                                                  <span className="whitespace-pre-wrap">{msg.text}</span>
                                                </div>
                                              ))
                                            ) : (
                                              <p className="text-xs text-white/30">无消息</p>
                                            )}
                                          </div>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
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
