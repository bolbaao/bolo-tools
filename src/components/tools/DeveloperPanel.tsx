"use client";

import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api";
import { getAdminDeveloperDocs } from "@/lib/admin";
import { markdownToHtml } from "@/lib/text-tools";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export default function DeveloperPanel() {
  const { user, loading: authLoading } = useAuth();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const text = await getAdminDeveloperDocs();
      setContent(text);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.isAdmin) void load();
  }, [user?.isAdmin, load]);

  if (authLoading) {
    return <p className="text-center text-sm text-white/40 py-20">验证登录状态…</p>;
  }

  if (!user?.isAdmin) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-white/50">需要管理员账号才能查看开发者手册</p>
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

  if (loading) {
    return <p className="text-center text-sm text-white/40 py-20">加载开发者手册…</p>;
  }

  if (error) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-red-400/90 text-sm">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full bg-white/10 px-5 py-2 text-sm text-white/80 hover:bg-white/15"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <article
      className="developer-docs max-w-none text-sm leading-relaxed text-white/75 [&_.md-h]:mt-6 [&_.md-h]:mb-3 [&_.md-h]:font-semibold [&_.md-h]:text-white [&_h1.md-h]:text-xl [&_h2.md-h]:text-lg [&_h3.md-h]:text-base [&_.md-p]:mb-3 [&_.md-ul]:mb-3 [&_.md-ul]:list-disc [&_.md-ul]:pl-5 [&_.md-ul]:space-y-1 [&_.md-code]:mb-4 [&_.md-code]:overflow-x-auto [&_.md-code]:rounded-xl [&_.md-code]:bg-black/30 [&_.md-code]:p-4 [&_.md-code]:text-xs [&_.md-code]:text-white/80 [&_.md-inline]:rounded [&_.md-inline]:bg-white/10 [&_.md-inline]:px-1 [&_.md-inline]:py-0.5 [&_.md-inline]:text-[0.85em] [&_.md-th]:px-3 [&_.md-th]:py-2 [&_.md-th]:text-left [&_.md-th]:text-white/80 [&_.md-td]:px-3 [&_.md-td]:py-2 [&_.md-td]:border-t [&_.md-td]:border-white/5 [&_strong]:text-white/90 [&_a]:text-sky-300/90 [&_a]:underline [&_a]:underline-offset-2"
      dangerouslySetInnerHTML={{ __html: markdownToHtml(content ?? "") }}
    />
  );
}
