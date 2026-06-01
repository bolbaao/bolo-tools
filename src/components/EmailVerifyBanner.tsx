"use client";

import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api";
import { useState } from "react";

export default function EmailVerifyBanner() {
  const { user, resendVerification } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [devVerifyUrl, setDevVerifyUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user || user.emailVerified) return null;

  const handleResend = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    setDevCode(null);
    setDevVerifyUrl(null);
    try {
      const result = await resendVerification();
      setMessage(result.message || "验证邮件已发送，请查收邮箱");
      setDevCode(result.devMode && result.code ? result.code : null);
      setDevVerifyUrl(result.devMode && result.verifyUrl ? result.verifyUrl : null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "发送失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="mt-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            邮箱 <span className="font-medium">{user.email}</span> 尚未验证。
            验证后可使用对话历史持久化、记忆库与自动记忆提取。
          </p>
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={busy}
            className="shrink-0 rounded-full bg-amber-500/20 px-4 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-500/30 disabled:opacity-50"
          >
            {busy ? "发送中…" : "重新发送验证邮件"}
          </button>
        </div>
        {message && <p className="mt-2 text-xs text-emerald-300/90">{message}</p>}
        {devCode && (
          <p className="mt-2 text-xs font-mono tracking-widest text-amber-200">
            开发模式验证码：{devCode}
          </p>
        )}
        {devVerifyUrl && (
          <p className="mt-1 break-all text-xs text-amber-200/80">
            验证链接：{devVerifyUrl}
          </p>
        )}
        {error && <p className="mt-2 text-xs text-red-300/90">{error}</p>}
      </div>
    </div>
  );
}
