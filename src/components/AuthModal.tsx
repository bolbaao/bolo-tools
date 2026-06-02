"use client";

import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  initialMode?: "login" | "register";
};

function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete,
  onKeyDown,
  showToggle = true,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  showToggle?: boolean;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        type={showToggle && show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`w-full rounded-xl border input-dark px-4 py-3 text-sm focus:outline-none ${showToggle ? "pr-11" : ""}`}
      />
      {showToggle ? (
        <button
          type="button"
          onClick={() => setShow((prev) => !prev)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 transition-colors hover:text-white/60"
          aria-label={show ? "隐藏密码" : "显示密码"}
        >
          {show ? (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
              />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          )}
        </button>
      ) : null}
    </div>
  );
}

export default function AuthModal({ open, onClose, initialMode = "login" }: Props) {
  const { login, register, fetchRegisterCaptcha } = useAuth();
  const usernameRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captchaId, setCaptchaId] = useState("");
  const [captchaImage, setCaptchaImage] = useState("");
  const [captchaCode, setCaptchaCode] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    try {
      const next = await fetchRegisterCaptcha();
      setCaptchaId(next.captchaId);
      setCaptchaImage(next.image);
      setCaptchaCode("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "验证码加载失败");
    } finally {
      setCaptchaLoading(false);
    }
  }, [fetchRegisterCaptcha]);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setUsername("");
      setPassword("");
      setConfirmPassword("");
      setCaptchaId("");
      setCaptchaImage("");
      setCaptchaCode("");
      setError(null);
      setSuccess(null);
      setTimeout(() => usernameRef.current?.focus(), 100);
      if (initialMode === "register") {
        void loadCaptcha();
      }
    }
  }, [open, initialMode, loadCaptcha]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const submit = async () => {
    if (!username.trim() || !password || loading) return;
    if (mode === "register") {
      if (!confirmPassword || !captchaCode.trim()) return;
      if (password !== confirmPassword) {
        setError("两次输入的密码不一致");
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
          password,
          confirmPassword,
          captchaId,
          captchaCode.trim(),
        );
        setSuccess(msg || "注册成功");
        onClose();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "操作失败");
      if (mode === "register") {
        void loadCaptcha();
      }
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
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl btn-primary text-2xl font-semibold shadow-lg">
            记
          </span>
        </div>
        <h2 className="mt-5 text-center text-lg font-semibold text-white tracking-tight">
          {mode === "login" ? "登录" : "注册"}
        </h2>
        <p className="mt-2 text-center text-xs text-white/40">
          {mode === "login"
            ? "登录后可使用专属记忆库与对话历史"
            : "填写用户名和密码即可完成注册"}
        </p>

        <input
          ref={usernameRef}
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="用户名（3–32 字符）"
          autoComplete="username"
          className="mt-6 w-full rounded-xl border input-dark px-4 py-3 text-sm focus:outline-none"
        />

        <div className="mt-3">
          <PasswordInput
            value={password}
            onChange={setPassword}
            placeholder="密码（至少 6 位）"
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
              showToggle={false}
              autoComplete="new-password"
              onKeyDown={(e) => e.key === "Enter" && void submit()}
            />
          </div>
        )}

        {mode === "register" && (
          <div className="mt-3">
            <label htmlFor="register-captcha" className="mb-2 block text-xs text-white/45">
              图形验证码
            </label>
            <input
              id="register-captcha"
              type="text"
              value={captchaCode}
              onChange={(e) => setCaptchaCode(e.target.value.replace(/\s/g, "").slice(0, 8))}
              placeholder="输入验证码"
              autoComplete="off"
              className="w-full rounded-xl border input-dark px-4 py-3 text-sm focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void loadCaptcha()}
              disabled={captchaLoading}
              className="relative mt-2 overflow-hidden rounded-xl border border-white/10 bg-white/5 transition-opacity hover:opacity-90 disabled:opacity-50"
              aria-label="刷新验证码"
              title="刷新验证码"
            >
              {captchaImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={captchaImage} alt="图形验证码" className="block h-10 w-[7.5rem]" />
              ) : (
                <span className="flex h-10 w-[7.5rem] items-center justify-center text-xs text-white/35">
                  {captchaLoading ? "加载中…" : "点击刷新"}
                </span>
              )}
            </button>
          </div>
        )}

        {error && (
          <p className="mt-3 text-center text-xs text-danger/90">{error}</p>
        )}
        {success && (
          <p className="mt-3 text-center text-xs text-success/90">{success}</p>
        )}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={
            loading ||
            !username.trim() ||
            !password ||
            (mode === "register" && (!confirmPassword || !captchaCode.trim() || !captchaId))
          }
          className="mt-5 w-full rounded-full btn-primary py-3 text-sm font-medium disabled:opacity-50 transition-all"
        >
          {loading ? "处理中…" : mode === "login" ? "登录" : "注册"}
        </button>

        <button
          type="button"
          onClick={() => {
            const nextMode = mode === "login" ? "register" : "login";
            setMode(nextMode);
            setError(null);
            setSuccess(null);
            setCaptchaCode("");
            if (nextMode === "register") {
              void loadCaptcha();
            } else {
              setCaptchaId("");
              setCaptchaImage("");
            }
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
