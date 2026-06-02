"use client";

import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api";
import { useState } from "react";

export default function EmailVerifyBanner() {
  const { user, resendVerification } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [devModeHint, setDevModeHint] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user || user.emailVerified) return null;

  const handleResend = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    setDevModeHint(false);
    try {
      const result = await resendVerification();
      setMessage(result.message || "验证邮件已发送，请查收邮箱");
      setDevModeHint(Boolean(result.devMode));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "发送失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="mt-2 rounded-xl banner-warn px-4 py-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            邮箱 <span className="font-medium">{user.email}</span> 尚未验证。
            验证后可使用对话历史持久化、记忆库与自动记忆提取。
          </p>
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={busy}
            className="shrink-0 rounded-full bg-warn/15 px-4 py-1.5 text-xs font-medium text-ink hover:bg-warn/22 disabled:opacity-50"
          >
            {busy ? "发送中…" : "重新发送验证邮件"}
          </button>
        </div>
        {message && <p className="mt-2 text-xs text-success/90">{message}</p>}
        {devModeHint && (
          <p className="mt-2 text-xs text-warn/90">
            开发模式：验证链接与验证码已输出至服务器控制台
          </p>
        )}
        {error && <p className="mt-2 text-xs text-danger/90">{error}</p>}
      </div>
    </div>
  );
}
