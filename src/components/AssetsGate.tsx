"use client";

import AssetsPanel from "@/components/tools/AssetsPanel";
import { ApiError } from "@/lib/api";
import { checkAssetsSession, loginAssets } from "@/lib/assets";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function AssetsGate() {
  const [status, setStatus] = useState<"loading" | "ok" | "denied">("loading");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAssetsSession()
      .then((ok) => setStatus(ok ? "ok" : "denied"))
      .catch(() => setStatus("denied"));
  }, []);

  const submit = async () => {
    if (!password.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await loginAssets(password.trim());
      setStatus("ok");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "验证失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading") {
    return (
      <p className="text-center text-sm text-white/40 py-20">验证访问权限…</p>
    );
  }

  if (status === "denied") {
    return (
      <div className="mx-auto max-w-sm py-16 space-y-4 text-center">
        <p className="text-white/50">请输入素材库访问密码</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
          placeholder="密码"
          autoComplete="current-password"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
        {error ? <p className="text-xs text-red-400/90">{error}</p> : null}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting || !password.trim()}
          className="w-full rounded-full bg-gradient-to-r from-blue-500 to-violet-600 py-3 text-sm font-medium text-white disabled:opacity-50 hover:brightness-110 transition-all"
        >
          {submitting ? "验证中…" : "进入素材库"}
        </button>
        <Link
          href="/"
          className="inline-flex text-xs text-white/35 hover:text-white/55 transition-colors"
        >
          返回首页
        </Link>
      </div>
    );
  }

  return <AssetsPanel />;
}
