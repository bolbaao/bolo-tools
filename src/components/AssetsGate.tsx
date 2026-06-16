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
      <div className="flex flex-col items-center justify-center py-24">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-accent/80" />
        <p className="mt-4 text-sm text-white/40">验证访问权限…</p>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="mx-auto max-w-sm px-4 py-12 sm:py-16">
        <div className="toolkit-modal-panel p-6 sm:p-8 text-center">
          <p className="text-[1.05rem] font-semibold tracking-tight text-white/90">素材库</p>
          <p className="mt-2 text-xs leading-relaxed text-white/40">请输入访问密码以进入你的专属素材库</p>

          <form
            className="mt-6 space-y-3.5 text-left"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div>
              <label htmlFor="assets-password" className="auth-field-label">
                访问密码
              </label>
              <input
                id="assets-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入密码"
                autoComplete="current-password"
                className="mt-1.5 w-full rounded-xl border input-dark px-4 py-2.5 text-sm focus:outline-none"
              />
            </div>

            {error ? (
              <p className="auth-alert auth-alert--error" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting || !password.trim()}
              className="auth-submit-btn flex w-full items-center justify-center gap-2 rounded-full btn-primary py-3 text-sm font-medium disabled:opacity-50 transition-all"
            >
              {submitting ? "验证中…" : "进入素材库"}
            </button>
          </form>

          <Link
            href="/"
            className="mt-4 inline-flex text-xs text-white/35 transition-colors hover:text-white/55"
          >
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  return <AssetsPanel />;
}
