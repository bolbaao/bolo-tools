"use client";

import AuthModal from "@/components/AuthModal";
import { notifyHomeBackgroundUpdated } from "@/components/home/HomeBackground";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api";
import {
  clearLocalHomeBackground,
  fetchHomeBackground,
  HOME_BG_LOCAL_KEY,
  loadLocalHomeBackground,
  removeHomeBackground,
  saveLocalHomeBackground,
  uploadHomeBackground,
} from "@/lib/home-background";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";

const ACCEPT = "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov";

export default function HomeBackgroundControl() {
  const pathname = usePathname();
  const { phase } = useWorkspace();
  const isIntroScreen = pathname === "/" && phase === "intro";
  const { user, loading: authLoading } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasBackground, setHasBackground] = useState(false);
  const [label, setLabel] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    if (user) {
      try {
        const info = await fetchHomeBackground();
        setHasBackground(info.configured);
        setLabel(info.name ?? null);
        return;
      } catch {
        setHasBackground(false);
        setLabel(null);
        return;
      }
    }
    const localFlag = localStorage.getItem(HOME_BG_LOCAL_KEY) === "1";
    if (localFlag) {
      const url = await loadLocalHomeBackground();
      setHasBackground(Boolean(url));
      if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
      setLabel("本机已保存");
      return;
    }
    setHasBackground(false);
    setLabel(null);
  }, [user]);

  useEffect(() => {
    if (!isIntroScreen || authLoading) return;
    void refreshStatus();
  }, [isIntroScreen, authLoading, refreshStatus, user]);

  useEffect(() => {
    if (!isIntroScreen) return;
    const onUpdate = () => void refreshStatus();
    window.addEventListener("home-background-updated", onUpdate);
    return () => window.removeEventListener("home-background-updated", onUpdate);
  }, [isIntroScreen, refreshStatus]);

  const handleFile = async (file: File | null) => {
    if (!file || busy) return;
    if (!file.type.startsWith("video/")) {
      setError("请选择 MP4、WebM 或 MOV 视频");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("视频不能超过 50MB");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (user) {
        const info = await uploadHomeBackground(file);
        setHasBackground(info.configured);
        setLabel(info.name ?? file.name);
      } else {
        await saveLocalHomeBackground(file);
        setHasBackground(true);
        setLabel(file.name);
      }
      notifyHomeBackgroundUpdated();
      setOpen(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "上传失败，请稍后重试");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (user) {
        await removeHomeBackground();
      } else {
        await clearLocalHomeBackground();
      }
      setHasBackground(false);
      setLabel(null);
      notifyHomeBackgroundUpdated();
      setOpen(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "移除失败");
    } finally {
      setBusy(false);
    }
  };

  if (!isIntroScreen) return null;

  return (
    <>
      <div className="home-bg-control absolute bottom-5 right-5 z-40 sm:bottom-6 sm:right-6">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="home-bg-control-trigger flex items-center gap-2 rounded-full border border-white/[0.1] bg-surface-elevated/85 px-3.5 py-2 text-xs text-white/55 backdrop-blur-md transition-colors hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-white/80"
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <svg className="h-4 w-4 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          背景视频
        </button>

        {open ? (
          <div
            className="home-bg-control-panel absolute bottom-full right-0 mb-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-white/[0.1] bg-surface-elevated/95 p-4 shadow-xl backdrop-blur-xl"
            role="dialog"
            aria-label="主页背景视频设置"
          >
            <p className="text-sm font-medium text-white/85">自定义主页背景</p>
            <p className="mt-1.5 text-xs leading-relaxed text-white/40">
              上传短视频作为背景，自动静音循环播放。未设置时显示默认粒子连线背景（鼠标靠近会高亮）。
              {user ? " 登录用户的背景会同步到账号。" : " 未登录时仅保存在本浏览器。"}
            </p>

            {hasBackground && label ? (
              <p className="mt-3 truncate text-xs text-white/50" title={label}>
                当前：{label}
              </p>
            ) : null}

            {error ? <p className="mt-2 text-xs text-red-400/90">{error}</p> : null}

            <div className="mt-4 flex flex-col gap-2">
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className="rounded-xl border border-accent/30 bg-accent/15 px-3 py-2.5 text-sm text-white/85 transition-colors hover:bg-accent/25 disabled:opacity-50"
              >
                {busy ? "处理中…" : hasBackground ? "更换视频" : "上传视频"}
              </button>
              {hasBackground ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleRemove()}
                  className="rounded-xl px-3 py-2 text-sm text-white/45 transition-colors hover:bg-white/[0.05] hover:text-white/70 disabled:opacity-50"
                >
                  恢复默认背景
                </button>
              ) : null}
              {!user && !authLoading ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setAuthOpen(true);
                  }}
                  className="text-left text-xs text-white/35 transition-colors hover:text-white/55"
                >
                  登录后可跨设备同步
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} initialMode="login" />
    </>
  );
}
