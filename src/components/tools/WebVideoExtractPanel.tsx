"use client";

import ActionButton from "@/components/ActionButton";
import CopyButton from "@/components/CopyButton";
import { ToolError, ToolSection } from "@/components/tools/ToolSection";
import { useAgentPrefill } from "@/hooks/useAgentPrefill";
import { ApiError, apiNotFoundMessage, apiPost, apiUrl, downloadBlob } from "@/lib/api";
import { toUserFacingErrorMessage } from "@/lib/service-message";
import Link from "next/link";
import { useCallback, useState } from "react";

type PageVideo = {
  label: string;
  url: string;
  type: string;
  source: string;
  downloadUrl?: string | null;
};

type YtdlpFormat = {
  formatId?: string;
  ext?: string;
  resolution?: string;
  url: string;
  downloadUrl?: string;
};

type ExtractResult = {
  ok: boolean;
  pageTitle: string;
  pageUrl: string;
  videos: PageVideo[];
  ytdlp?: {
    platform: string;
    title: string;
    pageUrl: string;
    thumbnail?: string;
    duration?: number;
    formats: YtdlpFormat[];
  } | null;
};

function extractUrlFromText(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/https?:\/\/[^\s<>"']+/i);
  if (match) return match[0].replace(/[.,;:!?)]+$/u, "");
  const bare = trimmed.replace(/^\/+/, "");
  if (/^[\w-]+(?:\.[\w-]+)+(?:[/:?#]|$)/i.test(bare)) {
    return `https://${bare}`;
  }
  return trimmed;
}

function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function WebVideoExtractPanel() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);

  const handleExtract = useCallback(async (urlOverride?: string) => {
    const target = extractUrlFromText((urlOverride ?? url).trim());
    if (!target) {
      setError("请先填写网页地址");
      return;
    }
    setUrl(target);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiPost<ExtractResult>("/api/web-video/extract", { url: target });
      setResult(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : toUserFacingErrorMessage("解析失败"));
    } finally {
      setLoading(false);
    }
  }, [url]);

  useAgentPrefill("web-video-extract", {
    apply: (fields) => {
      if (fields.url) setUrl(extractUrlFromText(fields.url));
    },
    canSubmit: (fields) => Boolean(extractUrlFromText(fields.url || "").trim()),
    submit: (fields) => handleExtract(extractUrlFromText(fields.url || "")),
  });

  const handleDownload = async (downloadPath: string, filename: string, key: string) => {
    setDownloading(key);
    try {
      const res = await fetch(apiUrl(downloadPath));
      if (!res.ok) {
        if (res.status === 404) throw new Error(apiNotFoundMessage());
        const data = await res.json().catch(() => ({}));
        throw new Error(toUserFacingErrorMessage((data as { error?: string }).error || "下载失败"));
      }
      const blob = await res.blob();
      downloadBlob(blob, filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : "下载失败");
    } finally {
      setDownloading(null);
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) setUrl(extractUrlFromText(text));
    } catch {
      setError("无法读取剪贴板，请手动粘贴");
    }
  };

  return (
    <div className="space-y-5">
      <ToolSection
        title="网页地址"
        desc="粘贴包含视频的网页链接，系统会扫描页面中的视频地址并尝试解析可下载流。"
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            data-tool-primary-input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article-with-video"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleExtract();
            }}
          />
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => void pasteFromClipboard()}
              className="rounded-xl border border-white/10 px-4 py-3 text-sm text-white/60 hover:bg-white/5"
            >
              粘贴
            </button>
            <ActionButton
              label="扫描网页"
              onClick={() => void handleExtract()}
              loading={loading}
              className="!px-5"
            />
          </div>
        </div>
      </ToolSection>

      {error ? <ToolError>{error}</ToolError> : null}

      {result ? (
        <div className="space-y-5" data-tool-result>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
            <p className="text-sm font-medium text-white/85">{result.pageTitle}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <CopyButton text={result.pageUrl} label="复制网页链接" className="!px-2 !py-1" />
            </div>
          </div>

          {result.videos.length ? (
            <ToolSection title="页面内视频" desc="从 HTML、脚本或元信息中找到的地址。">
              <ul className="space-y-3">
                {result.videos.map((item) => (
                  <li
                    key={item.url}
                    className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white/85">{item.label}</p>
                        <p className="mt-1 break-all text-xs text-white/45">{item.url}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-wide text-white/30">
                          {item.type}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <CopyButton text={item.url} label="复制" className="!px-2 !py-1" />
                        {item.type === "embed" ? (
                          <Link
                            href={`/tools/video-extract?url=${encodeURIComponent(item.url)}`}
                            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
                          >
                            去链接提取
                          </Link>
                        ) : item.downloadUrl ? (
                          <ActionButton
                            variant="secondary"
                            label="下载"
                            loading={downloading === item.url}
                            onClick={() =>
                              void handleDownload(
                                item.downloadUrl!,
                                `${result.pageTitle.slice(0, 40).replace(/[<>:"/\\|?*]/g, "_") || "video"}.${item.type === "m3u8" ? "mp4" : item.type || "mp4"}`,
                                item.url,
                              )
                            }
                            className="!min-h-0 !w-auto !px-3 !py-1.5 !text-xs"
                          />
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </ToolSection>
          ) : null}

          {result.ytdlp?.formats?.length ? (
            <ToolSection
              title="智能解析"
              desc="页面可能嵌入了平台播放器，已通过解析引擎找到可下载版本。"
            >
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-sm font-medium text-white/85">{result.ytdlp.title}</p>
                {result.ytdlp.duration ? (
                  <p className="mt-1 text-xs text-white/45">
                    时长 {formatDuration(result.ytdlp.duration)}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.ytdlp.formats.map((fmt) => (
                    <ActionButton
                      key={fmt.formatId || fmt.url}
                      variant="secondary"
                      label={fmt.resolution || fmt.ext || "下载"}
                      loading={downloading === (fmt.formatId || fmt.url)}
                      onClick={() =>
                        void handleDownload(
                          fmt.downloadUrl || "",
                          `${result.ytdlp!.title.slice(0, 40).replace(/[<>:"/\\|?*]/g, "_") || "video"}.${fmt.ext || "mp4"}`,
                          fmt.formatId || fmt.url,
                        )
                      }
                      className="!min-h-0 !w-auto !px-3 !py-1.5 !text-xs"
                    />
                  ))}
                </div>
              </div>
            </ToolSection>
          ) : null}
        </div>
      ) : null}

      <p className="text-center text-xs text-white/35">
        若页面只有抖音、B 站等分享链接，请使用
        <Link href="/tools/video-extract" className="mx-1 text-teal-600/90 hover:underline">
          视频链接提取
        </Link>
        。
      </p>
    </div>
  );
}
