"use client";

import { loginAssets } from "@/lib/assets";
import { ApiError } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function AssetsPasswordModal({ open, onClose }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPassword("");
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const submit = async () => {
    if (!password.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      await loginAssets(password.trim());
      onClose();
      router.push("/tools/assets");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "验证失败");
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
      aria-label="素材库密码"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
        aria-label="关闭"
      />
      <div className="relative w-full max-w-sm bento-card p-6 sm:p-8 animate-[bento-in_0.35s_ease-out]">
        <div className="flex justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 text-2xl font-semibold text-white shadow-lg shadow-blue-500/30">
            菠
          </span>
        </div>
        <h2 className="mt-5 text-center text-lg font-semibold text-white tracking-tight">
          素材库
        </h2>
        <p className="mt-2 text-center text-xs text-white/40">
          请输入访问密码
        </p>

        <input
          ref={inputRef}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
          placeholder="密码"
          autoComplete="current-password"
          className="mt-6 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />

        {error && (
          <p className="mt-3 text-center text-xs text-red-400/90">{error}</p>
        )}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={loading || !password.trim()}
          className="mt-5 w-full rounded-full bg-gradient-to-r from-blue-500 to-violet-600 py-3 text-sm font-medium text-white disabled:opacity-50 hover:brightness-110 transition-all"
        >
          {loading ? "验证中…" : "进入素材库"}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full text-xs text-white/35 hover:text-white/55 transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  );
}
