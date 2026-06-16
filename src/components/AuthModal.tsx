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
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
  onKeyDown,
  onBlur,
  showToggle = true,
  invalid = false,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  showToggle?: boolean;
  invalid?: boolean;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={showToggle && show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`w-full rounded-xl border input-dark px-4 py-2.5 text-sm focus:outline-none ${showToggle ? "pr-11" : ""} ${invalid ? "border-red-500/45 focus:border-red-500/55" : ""}`}
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

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
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
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const passwordMismatch =
    mode === "register" &&
    confirmPassword.length > 0 &&
    password !== confirmPassword;
  const showPasswordMismatch = passwordMismatch && confirmPasswordTouched;

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
      setConfirmPasswordTouched(false);
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
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const switchMode = (nextMode: "login" | "register") => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setError(null);
    setSuccess(null);
    setCaptchaCode("");
    setConfirmPasswordTouched(false);
    if (nextMode === "register") {
      void loadCaptcha();
    } else {
      setCaptchaId("");
      setCaptchaImage("");
    }
    setTimeout(() => usernameRef.current?.focus(), 50);
  };

  const submit = async () => {
    if (!username.trim() || !password || loading) return;
    if (mode === "register") {
      if (!confirmPassword || !captchaCode.trim()) return;
      if (password !== confirmPassword) {
        setConfirmPasswordTouched(true);
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

  const canSubmit =
    !loading &&
    Boolean(username.trim()) &&
    Boolean(password) &&
    (mode !== "register" ||
      (Boolean(confirmPassword) &&
        password === confirmPassword &&
        Boolean(captchaCode.trim()) &&
        Boolean(captchaId)));

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={mode === "login" ? "登录" : "注册"}
    >
      <button
        type="button"
        className="auth-modal-backdrop absolute inset-0 bg-black/65 backdrop-blur-md"
        onClick={onClose}
        aria-label="关闭"
      />
      <div className="auth-modal-panel toolkit-modal-panel relative w-full max-w-[400px] animate-[bento-in_0.35s_ease-out] sm:rounded-[1.5rem] rounded-t-[1.5rem]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-white/35 transition-colors hover:bg-white/[0.06] hover:text-white/70"
          aria-label="关闭"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="px-6 pt-7 pb-6 sm:px-8 sm:pt-8 sm:pb-7">
          <div className="text-center">
            <p className="text-[1.15rem] font-semibold tracking-tight text-white/92">
              春雨<span className="text-[0.72em] font-medium text-white/55 align-baseline">集</span>
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-white/40">
              {mode === "login"
                ? "登录后可使用记忆库、对话历史与跨设备同步"
                : "创建账号，解锁个人专属功能"}
            </p>
          </div>

          <div
            className="auth-mode-tabs mt-6"
            role="tablist"
            aria-label="登录或注册"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              onClick={() => switchMode("login")}
              className={`auth-mode-tab ${mode === "login" ? "auth-mode-tab--active" : ""}`}
            >
              登录
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              onClick={() => switchMode("register")}
              className={`auth-mode-tab ${mode === "register" ? "auth-mode-tab--active" : ""}`}
            >
              注册
            </button>
          </div>

          <form
            className="mt-5 space-y-3.5"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div>
              <label htmlFor="auth-username" className="auth-field-label">
                用户名
              </label>
              <input
                ref={usernameRef}
                id="auth-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="3–32 个字符"
                autoComplete="username"
                className="mt-1.5 w-full rounded-xl border input-dark px-4 py-2.5 text-sm focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="auth-password" className="auth-field-label">
                密码
              </label>
              <div className="mt-1.5">
                <PasswordInput
                  id="auth-password"
                  value={password}
                  onChange={setPassword}
                  placeholder="至少 6 位"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </div>
            </div>

            {mode === "register" && (
              <div>
                <label htmlFor="auth-confirm-password" className="auth-field-label">
                  确认密码
                </label>
                <div className="mt-1.5">
                  <PasswordInput
                    id="auth-confirm-password"
                    value={confirmPassword}
                    onChange={(v) => {
                      setConfirmPassword(v);
                      if (confirmPasswordTouched && v === password) setError(null);
                    }}
                    placeholder="再次输入密码"
                    showToggle={false}
                    autoComplete="new-password"
                    invalid={showPasswordMismatch}
                    onBlur={() => setConfirmPasswordTouched(true)}
                  />
                </div>
                {showPasswordMismatch ? (
                  <p className="auth-field-hint auth-field-hint--error" role="alert">
                    两次密码输入不一致
                  </p>
                ) : null}
              </div>
            )}

            {mode === "register" && (
              <div>
                <label htmlFor="register-captcha" className="auth-field-label">
                  图形验证码
                </label>
                <div className="mt-1.5 flex items-stretch gap-2.5">
                  <input
                    id="register-captcha"
                    type="text"
                    value={captchaCode}
                    onChange={(e) => setCaptchaCode(e.target.value.replace(/\s/g, "").slice(0, 8))}
                    placeholder="输入右侧字符"
                    autoComplete="off"
                    inputMode="text"
                    spellCheck={false}
                    className="auth-captcha-input min-w-0 flex-1 rounded-xl border input-dark px-4 py-3 text-base font-mono tracking-[0.18em] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void loadCaptcha()}
                    disabled={captchaLoading}
                    className="auth-captcha-btn shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] transition-all hover:border-white/16 hover:bg-white/[0.06] disabled:opacity-50"
                    aria-label="刷新验证码"
                    title="点击刷新验证码"
                  >
                    {captchaImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={captchaImage} alt="图形验证码" className="block h-12 w-[8.75rem]" />
                    ) : (
                      <span className="flex h-12 w-[8.75rem] items-center justify-center text-xs text-white/35">
                        {captchaLoading ? "加载中…" : "获取验证码"}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {error ? (
              <p className="auth-alert auth-alert--error" role="alert">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="auth-alert auth-alert--success" role="status">
                {success}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={!canSubmit}
              className="auth-submit-btn mt-1 flex w-full items-center justify-center gap-2 rounded-full btn-primary py-3 text-sm font-medium disabled:opacity-50 transition-all"
            >
              {loading ? (
                <>
                  <Spinner />
                  处理中…
                </>
              ) : mode === "login" ? (
                "登录"
              ) : (
                "注册"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
