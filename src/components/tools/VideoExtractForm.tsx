"use client";

import ActionButton from "@/components/ActionButton";
import { useAgentPrefill } from "@/hooks/useAgentPrefill";
import { ApiError, apiNotFoundMessage, apiPost, apiUrl, downloadBlob } from "@/lib/api";
import { useCallback, useMemo, useState } from "react";

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
  { id: "weixin-channels", label: "视频号" },
  { id: "douyin", label: "抖音" },
  { id: "bilibili", label: "哔哩哔哩" },
  { id: "youtube", label: "YouTube" },
  { id: "twitter", label: "X" },
  { id: "telegram", label: "Telegram" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "facebook", label: "Facebook" },
  { id: "reddit", label: "Reddit" },
  { id: "vimeo", label: "Vimeo" },
  { id: "pinterest", label: "Pinterest" },
  { id: "threads", label: "Threads" },
  { id: "twitch", label: "Twitch" },
] as const;

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
  if (u.includes("channels.weixin.qq.com") || u.includes("finder.video.qq.com")) {
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

  const detected = useMemo(() => detectClientPlatform(url), [url]);

  const handleExtract = useCallback(async (urlOverride?: string) => {
    const target = (urlOverride ?? url).trim();
    if (!target) return;
    if (urlOverride) setUrl(urlOverride);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiPost<ExtractResult>("/api/video/extract", { url: target });
      setResult(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "解析失败");
    } finally {
      setLoading(false);
    }
  }, [url]);

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
        throw new Error((data as { error?: string }).error || "下载失败");
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
    <div className="space-y-6">
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-3">
        <p className="text-xs font-medium text-white/50">已支持平台</p>
        <div className="flex flex-wrap gap-1.5">
          {SUPPORTED_PLATFORMS.map((p) => (
            <span
              key={p.id}
              className={`rounded-full px-2.5 py-0.5 text-[10px] ring-1 ${
                detected === p.id
                  ? "bg-blue-500/20 text-blue-200 ring-blue-500/35"
                  : "bg-white/5 text-white/40 ring-white/10"
              }`}
            >
              {p.label}
            </span>
          ))}
        </div>
        <p className="text-[11px] text-white/30 leading-relaxed">
          粘贴分享链接或整段文案即可。抖音、B 站、YouTube、X、微信视频号、Telegram、Instagram 等均支持多清晰度与本页直接下载。部分平台需登录或权限，解析失败时请换链接重试或联系客服。
        </p>
      </div>

      <div>
        <label htmlFor="video-url" className="block text-sm text-white/60 mb-2">
          视频链接
        </label>
        <input
          id="video-url"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="YouTube / 视频号 / X / 抖音 / B 站 等分享链接…"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
        />
        {detected && (
          <p className="mt-2 text-xs text-blue-300/70">
            已识别为 {platformLabel[detected] || detected}
          </p>
        )}
      </div>

      <div className="rounded-xl bg-white/[0.02] border border-white/8 p-4">
        {result ? (
          <div className="space-y-3">
            {result.platform && (
              <span className="inline-flex rounded-full bg-violet-500/15 px-2.5 py-0.5 text-[10px] text-violet-200 ring-1 ring-violet-500/25">
                {platformLabel[result.platform] || result.platform}
              </span>
            )}
            {result.thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.thumbnail}
                alt=""
                className="w-full max-h-48 object-cover rounded-lg"
              />
            )}
            <p className="text-sm font-medium text-white/90">{result.title}</p>
            <p className="text-xs text-white/40">
              {result.uploader && `${result.uploader} · `}
              {result.duration ? `${Math.round(result.duration)} 秒` : ""}
            </p>
            {result.formats.length > 1 && (
              <ul className="space-y-2 max-h-40 overflow-y-auto">
                {result.formats.map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-white/50 truncate">
                      {f.resolution || f.ext || `清晰度 ${i + 1}`}
                      {f.ext ? ` · ${f.ext}` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDownload(f, result.title)}
                      disabled={!!downloading}
                      className="shrink-0 text-xs text-blue-300/90 hover:text-blue-200 underline-offset-2 hover:underline disabled:opacity-50"
                    >
                      {downloading === (f.formatId || f.url) ? "下载中…" : "下载"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {best?.url && (
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleDownload(best, result.title)}
                  disabled={!!downloading}
                  className="inline-flex rounded-xl bg-gradient-to-r from-blue-600/50 to-violet-600/50 border border-blue-500/45 px-4 py-2.5 text-sm font-medium text-blue-50 hover:brightness-110 disabled:opacity-60"
                >
                  {downloading ? "正在下载…" : `直接下载 (${best.resolution || best.ext || "默认"})`}
                </button>
                <a
                  href={best.downloadUrl || best.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/55 hover:text-white/80 hover:border-white/25"
                >
                  新标签页打开
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="aspect-video rounded-lg bg-gradient-to-br from-white/5 to-white/[0.02] flex items-center justify-center">
            <span className="text-white/20 text-sm">
              {loading ? "解析中，请稍候…" : url ? "点击解析" : "输入链接后解析"}
            </span>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-400/90 text-center leading-relaxed">{error}</p>}

      <ActionButton
        label="解析并提取"
        loading={loading}
        loadingLabel="正在解析…"
        disabled={!url.trim()}
        onClick={() => void handleExtract()}
      />
      <p className="text-center text-xs text-white/25 leading-relaxed">
        下载经本机处理，请遵守各平台使用条款与版权规定
      </p>
    </div>
  );
}
