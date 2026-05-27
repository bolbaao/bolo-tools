"use client";

import ActionButton from "@/components/ActionButton";
import { useAgentPrefill } from "@/hooks/useAgentPrefill";
import { ApiError, apiPost, downloadBlob } from "@/lib/api";
import {
  compressImage,
  formatBytes,
  outputFilename,
  previewUrlFromFile,
  sharpenImage,
  type OutputFormat,
} from "@/lib/image-processing";
import { useCallback, useEffect, useState } from "react";

type Tab = "compress" | "sharpen" | "cutout" | "generate";

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "compress", label: "压缩", hint: "本地压缩体积" },
  { id: "sharpen", label: "变清晰", hint: "本地锐化增强" },
  { id: "cutout", label: "抠图", hint: "本地 AI 去背景" },
  { id: "generate", label: "AI 生图", hint: "xAI Grok Imagine" },
];

const genStyles = ["写实", "电影感", "动漫", "水彩", "赛博朋克", "国风"];
const aspectRatios = [
  { id: "1:1", label: "1:1" },
  { id: "16:9", label: "16:9" },
  { id: "9:16", label: "9:16" },
  { id: "4:3", label: "4:3" },
  { id: "3:2", label: "3:2" },
];

const sharpenLevels = [
  { id: "light" as const, label: "轻度" },
  { id: "standard" as const, label: "标准" },
  { id: "strong" as const, label: "强力" },
];

const formats: OutputFormat[] = ["JPG", "PNG", "WebP"];

function tabFromParam(value: string | null): Tab {
  if (
    value === "compress" ||
    value === "sharpen" ||
    value === "cutout" ||
    value === "generate"
  ) {
    return value;
  }
  return "compress";
}

const activeTabClass: Record<Tab, string> = {
  compress: "bg-lime-600/25 text-lime-100 border border-lime-500/30",
  sharpen: "bg-sky-600/25 text-sky-100 border border-sky-500/30",
  cutout: "bg-emerald-600/25 text-emerald-100 border border-emerald-500/30",
  generate: "bg-violet-600/25 text-violet-100 border border-violet-500/30",
};

type ImageStudioFormProps = {
  initialTab?: Tab;
};

export default function ImageStudioForm({ initialTab }: ImageStudioFormProps) {
  const [tab, setTab] = useState<Tab>(initialTab ?? "compress");
  const [file, setFile] = useState<File | null>(null);
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);
  const [quality, setQuality] = useState("75");
  const [format, setFormat] = useState<OutputFormat>("WebP");
  const [resultSize, setResultSize] = useState<number | null>(null);
  const [level, setLevel] = useState<"light" | "standard" | "strong">("standard");
  const [loadProgress, setLoadProgress] = useState("");
  const [prompt, setPrompt] = useState("");
  const [genStyle, setGenStyle] = useState("写实");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [resolution, setResolution] = useState<"1k" | "2k">("1k");
  const [genImageUrl, setGenImageUrl] = useState<string | null>(null);
  const [genMessage, setGenMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyPrefill = useCallback((fields: Record<string, string>) => {
    if (fields.mode) setTab(tabFromParam(fields.mode));
    if (fields.prompt) setPrompt(fields.prompt);
  }, []);
  useAgentPrefill("image-studio", applyPrefill);

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    return () => {
      if (beforeUrl) URL.revokeObjectURL(beforeUrl);
      if (afterUrl) URL.revokeObjectURL(afterUrl);
    };
  }, [beforeUrl, afterUrl]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (beforeUrl) URL.revokeObjectURL(beforeUrl);
    if (afterUrl) URL.revokeObjectURL(afterUrl);
    setFile(f ?? null);
    setBeforeUrl(f ? previewUrlFromFile(f) : null);
    setAfterUrl(null);
    setResultSize(null);
    setError(null);
  };

  const handleCompress = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const blob = await compressImage(file, format, Number(quality));
      setResultSize(blob.size);
      downloadBlob(blob, outputFilename(file.name, format));
    } catch (e) {
      setError(e instanceof Error ? e.message : "压缩失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSharpen = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const blob = await sharpenImage(file, level);
      if (afterUrl) URL.revokeObjectURL(afterUrl);
      setAfterUrl(URL.createObjectURL(blob));
      const ext = file.name.split(".").pop() || "png";
      downloadBlob(blob, `${file.name.replace(/\.[^.]+$/, "")}-sharp.${ext}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "处理失败");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setGenMessage(null);
    if (genImageUrl?.startsWith("blob:")) URL.revokeObjectURL(genImageUrl);
    setGenImageUrl(null);
    try {
      const data = await apiPost<{
        ok: boolean;
        imageUrl?: string;
        imageBase64?: string;
        mimeType?: string;
        message?: string;
      }>(
        "/api/xai-image/generate",
        {
          prompt: prompt.trim(),
          style: genStyle,
          aspectRatio,
          resolution,
        },
        { timeoutMs: 180000 },
      );
      if (data.imageBase64) {
        const mime = data.mimeType || "image/png";
        setGenImageUrl(`data:${mime};base64,${data.imageBase64}`);
      } else if (data.imageUrl) {
        setGenImageUrl(data.imageUrl);
      }
      setGenMessage(data.message || "生成完成");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "生成失败");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadGen = async () => {
    if (!genImageUrl) return;
    try {
      const res = await fetch(genImageUrl);
      const blob = await res.blob();
      downloadBlob(blob, `xai-${Date.now()}.png`);
    } catch {
      window.open(genImageUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleCutout = async () => {
    if (!file || !beforeUrl) return;
    setLoading(true);
    setLoadProgress("正在加载 AI 模型（首次较慢）…");
    setError(null);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      setLoadProgress("正在抠图…");
      const blob = await removeBackground(beforeUrl, {
        progress: (key, current, total) => {
          if (total) setLoadProgress(`${key} ${Math.round((current / total) * 100)}%`);
        },
      });
      if (afterUrl) URL.revokeObjectURL(afterUrl);
      setAfterUrl(URL.createObjectURL(blob));
      downloadBlob(blob, `${file.name.replace(/\.[^.]+$/, "")}-cutout.png`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "抠图失败");
    } finally {
      setLoading(false);
      setLoadProgress("");
    }
  };

  const primaryAction = () => {
    if (tab === "compress") return handleCompress();
    if (tab === "sharpen") return handleSharpen();
    if (tab === "generate") return handleGenerate();
    return handleCutout();
  };

  const primaryLabel = {
    compress: `压缩并下载 ${format}`,
    sharpen: "变清晰并下载",
    cutout: "开始智能抠图",
    generate: "xAI 生成图片",
  }[tab];

  const primaryDisabled = tab === "generate" ? !prompt.trim() : !file;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/8">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setError(null);
            }}
            className={`flex-1 min-w-[5rem] rounded-lg px-2 py-2.5 text-center transition-all ${
              tab === t.id ? activeTabClass[t.id] : "text-white/45 hover:text-white/70 hover:bg-white/5"
            }`}
          >
            <span className="block text-sm font-medium">{t.label}</span>
            <span className="block text-[10px] opacity-60 mt-0.5">{t.hint}</span>
          </button>
        ))}
      </div>

      {tab === "generate" ? (
        <div className="space-y-5">
          <div>
            <label htmlFor="gen-prompt" className="block text-sm text-white/60 mb-2">
              画面描述
            </label>
            <textarea
              id="gen-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, 500))}
              rows={4}
              placeholder="描述你想生成的画面…"
              className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
            />
            <p className="mt-1 text-right text-xs text-white/25">{prompt.length} / 500</p>
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-2">风格</label>
            <div className="flex flex-wrap gap-2">
              {genStyles.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setGenStyle(s)}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    genStyle === s
                      ? "bg-violet-600/25 text-violet-200 border border-violet-500/35"
                      : "bg-white/5 text-white/50 border border-white/8"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-sm text-white/60 mb-2">比例</label>
              <div className="flex flex-wrap gap-1.5">
                {aspectRatios.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setAspectRatio(r.id)}
                    className={`rounded-lg px-2.5 py-1 text-xs ${
                      aspectRatio === r.id
                        ? "bg-violet-600/25 text-violet-200 border border-violet-500/35"
                        : "bg-white/5 text-white/50 border border-white/8"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-2">清晰度</label>
              <div className="flex gap-2">
                {(["1k", "2k"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setResolution(r)}
                    className={`rounded-lg px-3 py-1.5 text-sm ${
                      resolution === r
                        ? "bg-violet-600/25 text-violet-200 border border-violet-500/35"
                        : "bg-white/5 text-white/50 border border-white/8"
                    }`}
                  >
                    {r.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 min-h-[200px] flex items-center justify-center">
            {genImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={genImageUrl}
                alt="生成结果"
                className="max-h-80 w-full object-contain rounded-lg"
              />
            ) : (
              <span className="text-white/25 text-sm">
                {loading ? "xAI 生成中，约需数秒…" : "输入描述后点击生成"}
              </span>
            )}
          </div>
          {genMessage && <p className="text-sm text-emerald-400/90 text-center">{genMessage}</p>}
          {genImageUrl && (
            <button
              type="button"
              onClick={handleDownloadGen}
              className="w-full rounded-xl border border-white/15 py-2.5 text-sm text-white/70 hover:text-white"
            >
              下载图片
            </button>
          )}
        </div>
      ) : (
        <>
      <label className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-8 cursor-pointer hover:border-white/25 hover:bg-white/[0.04] transition-all">
        {tab === "compress" && beforeUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={beforeUrl} alt="预览" className="max-h-40 rounded-lg object-contain" />
        ) : (
          <span className="text-3xl opacity-60">
            {tab === "compress" ? "◐" : tab === "sharpen" ? "◇" : "◈"}
          </span>
        )}
        <span className="text-sm text-white/50">{file?.name ?? "上传图片"}</span>
        <span className="text-xs text-white/25">浏览器本地处理，不上传服务器</span>
        <input type="file" accept="image/*" className="hidden" onChange={onFile} />
      </label>

      {tab === "compress" && (
        <>
          <div>
            <label className="block text-sm text-white/60 mb-2">输出格式</label>
            <div className="flex flex-wrap gap-2">
              {formats.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={`rounded-lg px-4 py-2 text-sm transition-all ${
                    format === f
                      ? "bg-lime-600/25 text-lime-200 border border-lime-500/35"
                      : "bg-white/5 text-white/50 border border-white/8 hover:bg-white/10"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="quality" className="block text-sm text-white/60 mb-2">
              压缩质量：{quality}%
            </label>
            <input
              id="quality"
              type="range"
              min={30}
              max={95}
              step={5}
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              className="w-full accent-lime-500"
            />
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 flex justify-between text-sm">
            <div>
              <p className="text-white/40 text-xs">原始大小</p>
              <p className="text-white/80 mt-1">{file ? formatBytes(file.size) : "—"}</p>
            </div>
            <div className="text-white/20">→</div>
            <div className="text-right">
              <p className="text-white/40 text-xs">压缩后</p>
              <p className="text-lime-300 mt-1">
                {resultSize != null ? formatBytes(resultSize) : "点击压缩后显示"}
              </p>
            </div>
          </div>
        </>
      )}

      {tab === "sharpen" && (
        <div>
          <label className="block text-sm text-white/60 mb-2">增强强度</label>
          <div className="flex flex-wrap gap-2">
            {sharpenLevels.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLevel(l.id)}
                className={`rounded-lg px-4 py-2 text-sm transition-all ${
                  level === l.id
                    ? "bg-sky-600/30 text-sky-200 border border-sky-500/40"
                    : "bg-white/5 text-white/50 border border-white/8 hover:bg-white/10"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {(tab === "sharpen" || tab === "cutout") && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/8 p-3">
            <p className="text-xs text-white/40 mb-2">原图</p>
            <div className="aspect-square rounded-lg bg-white/5 overflow-hidden flex items-center justify-center">
              {beforeUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={beforeUrl} alt="原图" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-white/25 text-xs">—</span>
              )}
            </div>
          </div>
          <div
            className="rounded-xl border border-white/8 p-3"
            style={
              tab === "cutout" && afterUrl
                ? {
                    backgroundImage:
                      "linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)",
                    backgroundSize: "12px 12px",
                    backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0",
                  }
                : undefined
            }
          >
            <p className="text-xs text-white/40 mb-2">{tab === "cutout" ? "抠图结果" : "清晰化后"}</p>
            <div className="aspect-square rounded-lg overflow-hidden flex items-center justify-center">
              {afterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={afterUrl} alt="结果" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-white/25 text-xs bg-white/5 w-full h-full flex items-center justify-center rounded-lg">
                  —
                </span>
              )}
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {loadProgress && tab !== "generate" && (
        <p className="text-center text-xs text-violet-300/80 animate-pulse">{loadProgress}</p>
      )}
      {error && <p className="text-sm text-red-400/90 text-center leading-relaxed">{error}</p>}

      <ActionButton
        label={primaryLabel}
        loading={loading}
        loadingLabel={tab === "cutout" && loadProgress ? loadProgress : undefined}
        disabled={primaryDisabled}
        onClick={primaryAction}
      />

      <p className="text-center text-xs text-white/25 leading-relaxed">
        {tab === "generate"
          ? "AI 生图由 xAI Grok Imagine 提供 · 需在 .env 配置 XAI_API_KEY"
          : "压缩、变清晰、抠图为浏览器本地处理"}
      </p>
    </div>
  );
}
