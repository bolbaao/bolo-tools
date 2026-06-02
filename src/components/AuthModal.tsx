"use client";

import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api";
import { useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  initialMode?: "login" | "register";
};

function PasswordInput({
  value,
  onChange,
  placeholder,
  show,
  autoComplete,
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  show: boolean;
  autoComplete?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <input
      type={show ? "text" : "password"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
    />
  );
}

export default function AuthModal({ open, onClose, initialMode = "login" }: Props) {
  const { login, register, sendRegisterCode } = useAuth();
  const usernameRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [codeCooldown, setCodeCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setUsername("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setVerificationCode("");
      setShowPassword(false);
      setCodeCooldown(0);
      setError(null);
      setSuccess(null);
      setDevCode(null);
      setTimeout(() => usernameRef.current?.focus(), 100);
    }
  }, [open, initialMode]);

  useEffect(() => {
    if (codeCooldown <= 0) return;
    const timer = setInterval(() => {
      setCodeCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [codeCooldown]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleSendCode = async () => {
    if (!email.trim() || sendingCode || codeCooldown > 0) return;
    setSendingCode(true);
    setError(null);
    setDevCode(null);
    try {
      const result = await sendRegisterCode(email.trim());
      setSuccess(result.message);
      setDevCode(result.devMode && result.code ? result.code : null);
      setCodeCooldown(60);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "发送失败");
    } finally {
      setSendingCode(false);
    }
  };

  const submit = async () => {
    if (!username.trim() || !password || loading) return;
    if (mode === "register") {
      if (!email.trim() || !confirmPassword || !verificationCode.trim()) return;
      if (password !== confirmPassword) {
        setError("两次输入的密码不一致");
        return;
      }
      if (!/^\d{6}$/.test(verificationCode.trim())) {
        setError("请输入 6 位邮箱验证码");
        return;
      }
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (mode === "login") {
        await login(username.trim(), password);
        onClose();
      } else {
        const msg = await register(
          username.trim(),
          email.trim(),
          password,
          confirmPassword,
          verificationCode.trim(),
        );
        setSuccess(msg || "注册成功");
        onClose();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "操作失败");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={mode === "login" ? "登录" : "注册"}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
        aria-label="关闭"
      />
      <div className="relative w-full max-w-sm bento-card p-6 sm:p-8 animate-[bento-in_0.35s_ease-out]">
        <div className="flex justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-2xl font-semibold text-white shadow-lg shadow-emerald-500/30">
            记
          </span>
        </div>
        <h2 className="mt-5 text-center text-lg font-semibold text-white tracking-tight">
          {mode === "login" ? "登录" : "注册"}
        </h2>
        <p className="mt-2 text-center text-xs text-white/40">
          {mode === "login"
            ? "登录后可使用专属记忆库与对话历史"
            : "设置密码后填写邮箱验证码完成注册"}
        </p>

        <input
          ref={usernameRef}
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="用户名（3–32 字符）"
          autoComplete="username"
          className="mt-6 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        />

        <div className="mt-3">
          <PasswordInput
            value={password}
            onChange={setPassword}
            placeholder="密码（至少 6 位）"
            show={showPassword}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            onKeyDown={(e) => e.key === "Enter" && mode === "login" && void submit()}
          />
        </div>

        {mode === "register" && (
          <div className="mt-3">
            <PasswordInput
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="确认密码"
              show={showPassword}
              autoComplete="new-password"
              onKeyDown={(e) => e.key === "Enter" && void submit()}
            />
          </div>
        )}

        <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-white/45 select-none">
          <input
            type="checkbox"
            checked={showPassword}
            onChange={(e) => setShowPassword(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 accent-emerald-500"
          />
          显示密码
        </label>

        {mode === "register" && (
          <>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="邮箱"
              autoComplete="email"
              className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={verificationCode}
                onChange={(e) =>
                  setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="邮箱验证码（6 位）"
                autoComplete="one-time-code"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              <button
                type="button"
                onClick={() => void handleSendCode()}
                disabled={sendingCode || !email.trim() || codeCooldown > 0}
                className="shrink-0 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-xs text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-40 whitespace-nowrap"
              >
                {sendingCode
                  ? "发送中…"
                  : codeCooldown > 0
                    ? `${codeCooldown}s`
                    : "获取验证码"}
              </button>
            </div>
          </>
        )}

        {error && (
          <p className="mt-3 text-center text-xs text-red-400/90">{error}</p>
        )}
        {success && (
          <p className="mt-3 text-center text-xs text-emerald-400/90">{success}</p>
        )}
        {devCode && (
          <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-sm font-mono tracking-widest text-amber-200">
            验证码（本地环境）：{devCode}
          </p>
        )}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={
            loading ||
            !username.trim() ||
            !password ||
            (mode === "register" &&
              (!email.trim() ||
                !confirmPassword ||
                verificationCode.trim().length !== 6))
          }
          className="mt-5 w-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 py-3 text-sm font-medium text-white disabled:opacity-50 hover:brightness-110 transition-all"
        >
          {loading ? "处理中…" : mode === "login" ? "登录" : "注册"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError(null);
            setSuccess(null);
            setShowPassword(false);
          }}
          className="mt-3 w-full text-xs text-white/40 hover:text-white/60 transition-colors"
        >
          {mode === "login" ? "还没有账号？去注册" : "已有账号？去登录"}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full text-xs text-white/35 hover:text-white/55 transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  );
}
