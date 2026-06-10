"use client";

import ActionButton from "@/components/ActionButton";
import CopyButton from "@/components/CopyButton";
import {
  ToolError,
  ToolSection,
} from "@/components/tools/ToolSection";
import { useAgentPrefill } from "@/hooks/useAgentPrefill";
import { ApiError, apiNotFoundMessage, apiPost, apiUrl, downloadBlob } from "@/lib/api";
import { toUserFacingErrorMessage } from "@/lib/service-message";
import { useCallback, useEffect, useMemo, useState } from "react";

const RECENT_URLS_KEY = "video-extract-recent";
const MAX_RECENT = 5;

type VideoFormat = {
  formatId?: string;
  ext?: string;
  resolution?: string;
  url: string;
  downloadUrl?: string;
};

type ExtractResult = {
  ok: boolean;
  platform?: string;
  title: string;
  thumbnail?: string;
  duration?: number;
  uploader?: string;
  webpageUrl?: string;
  formats: VideoFormat[];
};

const SUPPORTED_PLATFORMS = [
  { id: "weixin-channels", label: "视频号", icon: "📱" },
  { id: "youtube", label: "YouTube", icon: "▶️" },
  { id: "bilibili", label: "Bilibili", icon: "📺" },
  { id: "douyin", label: "抖音", icon: "🎵" },
  { id: "tiktok", label: "TikTok", icon: "🎬" },
  { id: "twitter", label: "X", icon: "𝕏" },
  { id: "generic", label: "更多", icon: "⋯" },
];

const platformLabel: Record<string, string> = {
  "weixin-channels": "微信视频号",
  douyin: "抖音",
  bilibili: "哔哩哔哩",
  youtube: "YouTube",
  twitter: "X (Twitter)",
  telegram: "Telegram",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  reddit: "Reddit",
  vimeo: "Vimeo",
  pinterest: "Pinterest",
  threads: "Threads",
  twitch: "Twitch",
  linkedin: "LinkedIn",
  snapchat: "Snapchat",
  generic: "其他",
};

function detectClientPlatform(text: string): string | null {
  const u = text.toLowerCase();
  if (u.includes("channels.weixin.qq.com") || u.includes("finder.video.qq.com") || u.includes("wxapp.tc.qq.com") || u.includes("weixin110.qq.com") || u.includes("weixin.qq.com/sph")) {
    return "weixin-channels";
  }
  if (u.includes("douyin") || u.includes("iesdouyin")) return "douyin";
  if (u.includes("bilibili") || u.includes("b23.tv") || /bv1[0-9a-z]{9}/i.test(text)) return "bilibili";
  if (u.includes("youtube") || u.includes("youtu.be")) return "youtube";
  if (u.includes("twitter.com") || u.includes("x.com") || u.includes("t.co/") || u.includes("fxtwitter") || u.includes("vxtwitter")) return "twitter";
  if (u.includes("t.me/") || u.includes("telegram") || u.includes("telesco.pe")) return "telegram";
  if (u.includes("instagram") || u.includes("instagr.am")) return "instagram";
  if (u.includes("tiktok")) return "tiktok";
  if (u.includes("facebook") || u.includes("fb.watch")) return "facebook";
  if (u.includes("reddit") || u.includes("redd.it")) return "reddit";
  if (u.includes("vimeo")) return "vimeo";
  if (u.includes("pinterest") || u.includes("pin.it")) return "pinterest";
  if (u.includes("threads.net")) return "threads";
  if (u.includes("twitch")) return "twitch";
  return null;
}

function extractUrlFromText(text: string): string {
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return text.trim();
  return match[0].replace(/[.,;:!?)]+$/u, "");
}

export default function VideoExtractForm() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [recentUrls, setRecentUrls] = useState<string[]>([]);

  const detected = useMemo(() => detectClientPlatform(url), [url]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(RECENT_URLS_KEY);
      if (raw) setRecentUrls(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
  }, []);

  const saveRecent = useCallback((target: string) => {
    setRecentUrls((prev) => {
      const next = [target, ...prev.filter((u) => u !== target)].slice(0, MAX_RECENT);
      try {
        sessionStorage.setItem(RECENT_URLS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) setUrl(extractUrlFromText(text));
    } catch {
      setError("无法读取剪贴板，请手动粘贴");
    }
  };

  const handleExtract = useCallback(async (urlOverride?: string) => {
    const target = extractUrlFromText((urlOverride ?? url).trim());
    if (!target) return;
    setUrl(target);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiPost<ExtractResult>("/api/video/extract", { url: target });
      setResult(data);
      saveRecent(target);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : toUserFacingErrorMessage("解析失败"));
    } finally {
      setLoading(false);
    }
  }, [url, saveRecent]);

  useAgentPrefill("video-extract", {
    apply: (fields) => {
      if (fields.url) setUrl(extractUrlFromText(fields.url));
    },
    canSubmit: (fields) => Boolean(extractUrlFromText(fields.url || "").trim()),
    submit: (fields) => handleExtract(extractUrlFromText(fields.url || "")),
  });

  const handleDownload = async (fmt: VideoFormat, title: string) => {
    const downloadPath =
      fmt.downloadUrl ||
      `/api/video/download?${new URLSearchParams({
        url: fmt.url,
        platform: result?.platform || "generic",
        name: `${title.slice(0, 60).replace(/[<>:"/\\|?*]/g, "_") || "video"}.${fmt.ext || "mp4"}`,
      })}`;
    const href = apiUrl(downloadPath);

    setDownloading(fmt.formatId || fmt.url);
    try {
      const res = await fetch(href);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(apiNotFoundMessage());
        }
        const data = await res.json().catch(() => ({}));
        throw new Error(toUserFacingErrorMessage((data as { error?: string }).error || "下载失败"));
      }
      const blob = await res.blob();
      const ext = fmt.ext || "mp4";
      const filename = `${title.slice(0, 60).replace(/[<>:"/\\|?*]/g, "_") || "video"}.${ext}`;
      downloadBlob(blob, filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : "下载失败，可尝试新标签页打开");
      window.open(href, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(null);
    }
  };

  const best = result?.formats?.[0];

  return (
    <>
      <div className="tool-inline-form">
        <input
          id="video-url"
          type="text"
          inputMode="url"
          data-tool-primary-input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && url.trim() && !loading) {
              e.preventDefault();
              void handleExtract();
            }
          }}
          placeholder="粘贴视频链接到这里…"
        />
        <ActionButton
          label="提取"
          loading={loading}
          loadingLabel="正在解析…"
          disabled={!url.trim()}
          onClick={() => void handleExtract()}
          className="!w-auto shrink-0"
        />
      </div>
      {detected ? (
        <p className="text-xs opacity-60">
          已识别为 {platformLabel[detected] || detected}
        </p>
      ) : null}
      {recentUrls.length > 0 && !url && (
        <div className="flex flex-wrap gap-1.5">
          {recentUrls.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUrl(u)}
              className="max-w-full truncate rounded-full bg-black/[0.04] px-2.5 py-0.5 text-[10px] opacity-50 hover:opacity-80"
              title={u}
            >
              {u.replace(/^https?:\/\//, "").slice(0, 40)}
            </button>
          ))}
        </div>
      )}

      {error && <ToolError>{error}</ToolError>}

      <div data-tool-result={result ? "" : undefined}>
        {result ? (
          <section className="tool-form-card space-y-4">
            {result.platform && (
              <span className="inline-flex rounded-full bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-violet-500/15">
                {platformLabel[result.platform] || result.platform}
              </span>
            )}
            {result.thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.thumbnail}
                alt=""
                className="w-full max-h-48 object-cover rounded-lg border border-black/6"
              />
            )}
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm font-medium flex-1">{result.title}</p>
              <div className="flex gap-1.5 shrink-0">
                <CopyButton text={result.title} label="复制标题" className="!px-2 !py-1" />
                {result.webpageUrl && (
                  <CopyButton text={result.webpageUrl} label="复制链接" className="!px-2 !py-1" />
                )}
              </div>
            </div>
            {(result.uploader || result.duration) && (
              <p className="text-xs opacity-50">
                {result.uploader && `${result.uploader} · `}
                {result.duration ? `${Math.round(result.duration)} 秒` : ""}
              </p>
            )}

            {best?.url ? (
              <div className="flex flex-wrap gap-2">
                <ActionButton
                  label={
                    downloading
                      ? "正在下载…"
                      : `下载视频 (${best.resolution || best.ext || "默认"})`
                  }
                  loading={!!downloading}
                  loadingLabel="正在下载…"
                  disabled={!!downloading}
                  onClick={() => handleDownload(best, result.title)}
                  className="!w-auto"
                />
                <a
                  href={apiUrl(
                    best.downloadUrl ||
                      `/api/video/download?${new URLSearchParams({
                        url: best.url,
                        platform: result.platform || "generic",
                        name: `${result.title.slice(0, 60).replace(/[<>:"/\\|?*]/g, "_") || "video"}.${best.ext || "mp4"}`,
                      })}`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium opacity-70 hover:opacity-100"
                >
                  新标签页打开
                </a>
              </div>
            ) : null}

            {result.formats.length > 1 && (
              <ul className="space-y-2 max-h-48 overflow-y-auto border-t border-black/6 pt-3">
                {result.formats.map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-2">
                    <span className="text-xs opacity-60 truncate">
                      {f.resolution || f.ext || `清晰度 ${i + 1}`}
                      {f.ext ? ` · ${f.ext}` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDownload(f, result.title)}
                      disabled={!!downloading}
                      className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700 underline-offset-2 hover:underline disabled:opacity-50"
                    >
                      {downloading === (f.formatId || f.url) ? "下载中…" : "下载"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <div className="tool-form-card aspect-video flex items-center justify-center">
            <span className="text-sm opacity-35">
              {loading ? "解析中，请稍候…" : url ? "点击「提取」开始解析" : "输入链接后提取"}
            </span>
          </div>
        )}
      </div>

      <ToolSection title="支持的平台">
        <div className="tool-platform-row">
          {SUPPORTED_PLATFORMS.map((p) => (
            <span key={p.id} className="tool-platform-badge">
              <span aria-hidden>{p.icon}</span>
              {p.label}
            </span>
          ))}
        </div>
      </ToolSection>

    </>
  );
}
