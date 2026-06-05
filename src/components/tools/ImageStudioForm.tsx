"use client";

import ActionButton from "@/components/ActionButton";
import { useAgentPrefill } from "@/hooks/useAgentPrefill";
import { useDisplayContent } from "@/hooks/useDisplayContent";
import { ApiError, apiPost, downloadBlob } from "@/lib/api";
import {
  compressImage,
  compositeSubjectOnBackground,
  formatBytes,
  outputFilename,
  prepareImageForEdit,
  previewUrlFromFile,
  sharpenImage,
  type OutputFormat,
} from "@/lib/image-processing";
import { getImageStudioFooterHint } from "@/lib/site-content";
import { useCallback, useEffect, useState } from "react";

type Tab = "compress" | "sharpen" | "cutout" | "bgreplace" | "watermark" | "beautify" | "edit" | "generate";

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "compress", label: "压缩", hint: "减小体积" },
  { id: "sharpen", label: "变清晰", hint: "锐化增强" },
  { id: "cutout", label: "抠图", hint: "智能去背景" },
  { id: "bgreplace", label: "换背景", hint: "证件照 / 场景" },
  { id: "watermark", label: "去水印", hint: "AI 智能修复" },
  { id: "beautify", label: "人像美化", hint: "一键变美" },
  { id: "edit", label: "修图", hint: "AI 改图" },
  { id: "generate", label: "AI 生图", hint: "文字描述成图" },
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

const editPresets = [
  "换成日系动漫风格",
  "增强色彩，让画面更鲜艳",
  "去除背景中的路人",
  "把天空改成晚霞",
  "修复老照片，提高清晰度",
];

const beautifyLevels = [
  { id: "natural" as const, label: "自然", desc: "轻度磨皮，保留真实感" },
  { id: "standard" as const, label: "标准", desc: "智能美颜，精神好看" },
  { id: "pro" as const, label: "精修", desc: "精致上镜，气质提升" },
];

const bgColorPresets = [
  { id: "white", label: "纯白", color: "#FFFFFF" },
  { id: "blue", label: "证件蓝", color: "#438EDB" },
  { id: "red", label: "证件红", color: "#D63636" },
  { id: "gray", label: "浅灰", color: "#F0F0F0" },
];

const bgAiPresets = [
  "干净白墙摄影棚",
  "海边日落",
  "城市街拍虚化背景",
  "简约 Office 办公环境",
  "樱花公园",
];

const watermarkLevels = [
  { id: "light" as const, label: "轻度", desc: "角落小水印、半透明 Logo" },
  { id: "standard" as const, label: "标准", desc: "常见水印与角标" },
  { id: "strong" as const, label: "强力", desc: "大面积或复杂叠加" },
];

function tabFromParam(value: string | null): Tab {
  if (
    value === "compress" ||
    value === "sharpen" ||
    value === "cutout" ||
    value === "bgreplace" ||
    value === "watermark" ||
    value === "beautify" ||
    value === "edit" ||
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
  bgreplace: "bg-teal-600/25 text-teal-100 border border-teal-500/30",
  watermark: "bg-orange-600/25 text-orange-100 border border-orange-500/30",
  beautify: "bg-rose-600/25 text-rose-100 border border-rose-500/30",
  edit: "bg-amber-600/25 text-amber-100 border border-amber-500/30",
  generate: "bg-violet-600/25 text-violet-100 border border-violet-500/30",
};

type ImageStudioFormProps = {
  initialTab?: Tab;
};

export default function ImageStudioForm({ initialTab }: ImageStudioFormProps) {
  const { isAdmin } = useDisplayContent();
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
  const [editPrompt, setEditPrompt] = useState("");
  const [editResolution, setEditResolution] = useState<"1k" | "2k">("2k");
  const [editMessage, setEditMessage] = useState<string | null>(null);
  const [beautifyLevel, setBeautifyLevel] = useState<"natural" | "standard" | "pro">("standard");
  const [beautifyResolution, setBeautifyResolution] = useState<"1k" | "2k">("2k");
  const [beautifyMessage, setBeautifyMessage] = useState<string | null>(null);
  const [bgMode, setBgMode] = useState<"color" | "upload" | "ai">("color");
  const [bgColor, setBgColor] = useState("#FFFFFF");
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [bgFileUrl, setBgFileUrl] = useState<string | null>(null);
  const [bgAiPrompt, setBgAiPrompt] = useState("");
  const [bgResolution, setBgResolution] = useState<"1k" | "2k">("2k");
  const [bgMessage, setBgMessage] = useState<string | null>(null);
  const [watermarkLevel, setWatermarkLevel] = useState<"light" | "standard" | "strong">("standard");
  const [watermarkResolution, setWatermarkResolution] = useState<"1k" | "2k">("2k");
  const [watermarkMessage, setWatermarkMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async (promptOverride?: string) => {
    const p = (promptOverride ?? prompt).trim();
    if (!p) return;
    if (promptOverride) setPrompt(promptOverride);
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
        "/api/ark-image/generate",
        {
          prompt: p,
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
  }, [prompt, genStyle, aspectRatio, resolution, genImageUrl]);

  useAgentPrefill("image-studio", {
    apply: (fields) => {
      if (fields.mode) setTab(tabFromParam(fields.mode));
      if (fields.prompt) {
        setPrompt(fields.prompt);
        setEditPrompt(fields.prompt);
        setBgAiPrompt(fields.prompt);
      }
    },
    canSubmit: (fields) =>
      (fields.mode === "generate" || !fields.mode) && Boolean(fields.prompt?.trim()),
    submit: (fields) => handleGenerate(fields.prompt),
  });

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    return () => {
      if (beforeUrl) URL.revokeObjectURL(beforeUrl);
      if (afterUrl) URL.revokeObjectURL(afterUrl);
      if (bgFileUrl) URL.revokeObjectURL(bgFileUrl);
    };
  }, [beforeUrl, afterUrl, bgFileUrl]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (beforeUrl) URL.revokeObjectURL(beforeUrl);
    if (afterUrl) URL.revokeObjectURL(afterUrl);
    setFile(f ?? null);
    setBeforeUrl(f ? previewUrlFromFile(f) : null);
    setAfterUrl(null);
    setResultSize(null);
    setEditMessage(null);
    setBeautifyMessage(null);
    setBgMessage(null);
    setWatermarkMessage(null);
    setError(null);
  };

  const onBgFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (bgFileUrl) URL.revokeObjectURL(bgFileUrl);
    setBgFile(f ?? null);
    setBgFileUrl(f ? previewUrlFromFile(f) : null);
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

  const handleDownloadGen = async () => {
    if (!genImageUrl) return;
    try {
      const res = await fetch(genImageUrl);
      const blob = await res.blob();
      downloadBlob(blob, `seedream-${Date.now()}.png`);
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

  const handleEdit = async () => {
    if (!file || !editPrompt.trim()) return;
    setLoading(true);
    setError(null);
    setEditMessage(null);
    if (afterUrl?.startsWith("blob:")) URL.revokeObjectURL(afterUrl);
    setAfterUrl(null);
    try {
      const imageDataUrl = await prepareImageForEdit(file, editResolution);
      const data = await apiPost<{
        ok: boolean;
        imageUrl?: string;
        imageBase64?: string;
        mimeType?: string;
        message?: string;
      }>(
        "/api/ark-image/edit",
        {
          prompt: editPrompt.trim(),
          imageDataUrl,
          resolution: editResolution,
        },
        { timeoutMs: 180000 },
      );
      if (data.imageBase64) {
        const mime = data.mimeType || "image/png";
        setAfterUrl(`data:${mime};base64,${data.imageBase64}`);
      } else if (data.imageUrl) {
        setAfterUrl(data.imageUrl);
      }
      setEditMessage(data.message || "修图完成");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "修图失败");
    } finally {
      setLoading(false);
    }
  };

  const handleBeautify = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setBeautifyMessage(null);
    if (afterUrl?.startsWith("blob:")) URL.revokeObjectURL(afterUrl);
    setAfterUrl(null);
    try {
      const imageDataUrl = await prepareImageForEdit(file, beautifyResolution);
      const data = await apiPost<{
        ok: boolean;
        imageUrl?: string;
        imageBase64?: string;
        mimeType?: string;
        message?: string;
      }>(
        "/api/ark-image/beautify",
        {
          imageDataUrl,
          level: beautifyLevel,
          resolution: beautifyResolution,
        },
        { timeoutMs: 180000 },
      );
      if (data.imageBase64) {
        const mime = data.mimeType || "image/png";
        setAfterUrl(`data:${mime};base64,${data.imageBase64}`);
      } else if (data.imageUrl) {
        setAfterUrl(data.imageUrl);
      }
      setBeautifyMessage(data.message || "人像美化完成");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "人像美化失败");
    } finally {
      setLoading(false);
    }
  };

  const handleBgReplace = async () => {
    if (!file || !beforeUrl) return;
    if (bgMode === "upload" && !bgFile) {
      setError("请上传背景图片");
      return;
    }
    if (bgMode === "ai" && !bgAiPrompt.trim()) {
      setError("请描述目标背景");
      return;
    }

    setLoading(true);
    setError(null);
    setBgMessage(null);
    if (afterUrl?.startsWith("blob:")) URL.revokeObjectURL(afterUrl);
    setAfterUrl(null);

    try {
      if (bgMode === "ai") {
        setLoadProgress("AI 换背景中…");
        const imageDataUrl = await prepareImageForEdit(file, bgResolution);
        const data = await apiPost<{
          ok: boolean;
          imageUrl?: string;
          imageBase64?: string;
          mimeType?: string;
          message?: string;
        }>(
          "/api/ark-image/replace-background",
          {
            imageDataUrl,
            backgroundPrompt: bgAiPrompt.trim(),
            resolution: bgResolution,
          },
          { timeoutMs: 180000 },
        );
        if (data.imageBase64) {
          const mime = data.mimeType || "image/png";
          setAfterUrl(`data:${mime};base64,${data.imageBase64}`);
        } else if (data.imageUrl) {
          setAfterUrl(data.imageUrl);
        }
        setBgMessage(data.message || "背景已替换");
        return;
      }

      setLoadProgress("正在加载 AI 模型（首次较慢）…");
      const { removeBackground } = await import("@imgly/background-removal");
      setLoadProgress("正在抠图…");
      const subjectBlob = await removeBackground(beforeUrl, {
        progress: (key, current, total) => {
          if (total) setLoadProgress(`${key} ${Math.round((current / total) * 100)}%`);
        },
      });
      setLoadProgress("正在合成背景…");
      const background =
        bgMode === "color"
          ? { type: "color" as const, color: bgColor }
          : { type: "image" as const, source: bgFile! };
      const blob = await compositeSubjectOnBackground(subjectBlob, background);
      setAfterUrl(URL.createObjectURL(blob));
      setBgMessage("背景已替换");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "换背景失败");
    } finally {
      setLoading(false);
      setLoadProgress("");
    }
  };

  const handleWatermark = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setWatermarkMessage(null);
    if (afterUrl?.startsWith("blob:")) URL.revokeObjectURL(afterUrl);
    setAfterUrl(null);
    try {
      const imageDataUrl = await prepareImageForEdit(file, watermarkResolution);
      const data = await apiPost<{
        ok: boolean;
        imageUrl?: string;
        imageBase64?: string;
        mimeType?: string;
        message?: string;
      }>(
        "/api/ark-image/watermark-remove",
        {
          imageDataUrl,
          level: watermarkLevel,
          resolution: watermarkResolution,
        },
        { timeoutMs: 180000 },
      );
      if (data.imageBase64) {
        const mime = data.mimeType || "image/png";
        setAfterUrl(`data:${mime};base64,${data.imageBase64}`);
      } else if (data.imageUrl) {
        setAfterUrl(data.imageUrl);
      }
      setWatermarkMessage(data.message || "水印已去除");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "去水印失败");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadResult = async (suffix: string) => {
    if (!afterUrl || !file) return;
    try {
      const res = await fetch(afterUrl);
      const blob = await res.blob();
      downloadBlob(blob, `${file.name.replace(/\.[^.]+$/, "")}-${suffix}.png`);
    } catch {
      window.open(afterUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleDownloadEdit = () => handleDownloadResult("edited");
  const handleDownloadBeautify = () => handleDownloadResult("beautified");
  const handleDownloadBg = () => handleDownloadResult("new-bg");
  const handleDownloadWatermark = () => handleDownloadResult("no-watermark");

  const primaryAction = () => {
    if (tab === "compress") return handleCompress();
    if (tab === "sharpen") return handleSharpen();
    if (tab === "beautify") return handleBeautify();
    if (tab === "edit") return handleEdit();
    if (tab === "generate") return handleGenerate();
    if (tab === "bgreplace") return handleBgReplace();
    if (tab === "watermark") return handleWatermark();
    return handleCutout();
  };

  const primaryLabel = {
    compress: `压缩并下载 ${format}`,
    sharpen: "变清晰并下载",
    cutout: "开始智能抠图",
    bgreplace: "开始换背景",
    watermark: "开始去水印",
    beautify: "一键人像美化",
    edit: "开始 AI 修图",
    generate: "生成图片",
  }[tab];

  const primaryDisabled =
    tab === "generate"
      ? !prompt.trim()
      : tab === "edit"
        ? !file || !editPrompt.trim()
        : tab === "bgreplace"
          ? !file || (bgMode === "upload" && !bgFile) || (bgMode === "ai" && !bgAiPrompt.trim())
          : !file;

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
                {loading ? "生成中，约需数秒…" : "输入描述后点击生成"}
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
      ) : tab === "bgreplace" ? (
        <div className="space-y-5">
          <label className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-8 cursor-pointer hover:border-white/25 hover:bg-white/[0.04] transition-all">
            {beforeUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={beforeUrl} alt="预览" className="max-h-40 rounded-lg object-contain" />
            ) : (
              <span className="text-3xl opacity-60">▣</span>
            )}
            <span className="text-sm text-white/50">{file?.name ?? "上传主体图片"}</span>
            <span className="text-xs text-white/25">人像、商品、宠物均可 · 自动抠图后换背景</span>
            <input type="file" accept="image/*" className="hidden" onChange={onFile} />
          </label>

          <div>
            <label className="block text-sm text-white/60 mb-2">背景方式</label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: "color" as const, label: "纯色背景" },
                  { id: "upload" as const, label: "上传背景图" },
                  { id: "ai" as const, label: "AI 场景" },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setBgMode(m.id)}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    bgMode === m.id
                      ? "bg-teal-600/25 text-teal-200 border border-teal-500/35"
                      : "bg-white/5 text-white/50 border border-white/8"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {bgMode === "color" ? (
            <div>
              <label className="block text-sm text-white/60 mb-2">背景颜色</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {bgColorPresets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setBgColor(p.color)}
                    className={`rounded-lg px-3 py-1.5 text-sm border ${
                      bgColor === p.color
                        ? "bg-teal-600/25 text-teal-200 border-teal-500/35"
                        : "bg-white/5 text-white/50 border-white/8"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="h-10 w-full cursor-pointer rounded-lg border border-white/10 bg-white/5"
                aria-label="自定义背景色"
              />
            </div>
          ) : null}

          {bgMode === "upload" ? (
            <label className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-6 cursor-pointer hover:border-white/25 transition-all">
              {bgFileUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bgFileUrl} alt="背景预览" className="max-h-28 rounded-lg object-cover" />
              ) : (
                <span className="text-2xl opacity-50">🖼</span>
              )}
              <span className="text-sm text-white/50">{bgFile?.name ?? "上传背景图片"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={onBgFile} />
            </label>
          ) : null}

          {bgMode === "ai" ? (
            <>
              <div>
                <label htmlFor="bg-ai-prompt" className="block text-sm text-white/60 mb-2">
                  目标背景描述
                </label>
                <textarea
                  id="bg-ai-prompt"
                  value={bgAiPrompt}
                  onChange={(e) => setBgAiPrompt(e.target.value.slice(0, 200))}
                  rows={2}
                  placeholder="例如：干净白墙摄影棚、海边日落…"
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">快捷场景</label>
                <div className="flex flex-wrap gap-2">
                  {bgAiPresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setBgAiPrompt(preset)}
                      className={`rounded-lg px-3 py-1.5 text-sm ${
                        bgAiPrompt === preset
                          ? "bg-teal-600/25 text-teal-200 border border-teal-500/35"
                          : "bg-white/5 text-white/50 border border-white/8"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">输出清晰度</label>
                <div className="flex gap-2">
                  {(["1k", "2k"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setBgResolution(r)}
                      className={`rounded-lg px-3 py-1.5 text-sm ${
                        bgResolution === r
                          ? "bg-teal-600/25 text-teal-200 border border-teal-500/35"
                          : "bg-white/5 text-white/50 border border-white/8"
                      }`}
                    >
                      {r.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : null}

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
            <div className="rounded-xl border border-white/8 p-3">
              <p className="text-xs text-white/40 mb-2">换背景后</p>
              <div className="aspect-square rounded-lg bg-white/5 overflow-hidden flex items-center justify-center">
                {afterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={afterUrl} alt="换背景结果" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-white/25 text-xs bg-white/5 w-full h-full flex items-center justify-center rounded-lg">
                    {loading ? "处理中…" : "—"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {bgMessage && <p className="text-sm text-emerald-400/90 text-center">{bgMessage}</p>}
          {afterUrl && (
            <button
              type="button"
              onClick={handleDownloadBg}
              className="w-full rounded-xl border border-white/15 py-2.5 text-sm text-white/70 hover:text-white"
            >
              下载结果
            </button>
          )}
        </div>
      ) : tab === "watermark" ? (
        <div className="space-y-5">
          <label className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-8 cursor-pointer hover:border-white/25 hover:bg-white/[0.04] transition-all">
            {beforeUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={beforeUrl} alt="预览" className="max-h-40 rounded-lg object-contain" />
            ) : (
              <span className="text-3xl opacity-60">◌</span>
            )}
            <span className="text-sm text-white/50">{file?.name ?? "上传带水印的图片"}</span>
            <span className="text-xs text-white/25">适合去除角标、Logo、叠加文字 · 请确保你有权处理该图片</span>
            <input type="file" accept="image/*" className="hidden" onChange={onFile} />
          </label>

          <div>
            <label className="block text-sm text-white/60 mb-2">去除强度</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {watermarkLevels.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setWatermarkLevel(l.id)}
                  className={`rounded-xl px-3 py-3 text-left transition-all ${
                    watermarkLevel === l.id
                      ? "bg-orange-600/25 text-orange-100 border border-orange-500/35"
                      : "bg-white/5 text-white/50 border border-white/8 hover:bg-white/10"
                  }`}
                >
                  <span className="block text-sm font-medium">{l.label}</span>
                  <span className="block text-[11px] opacity-70 mt-0.5">{l.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-2">输出清晰度</label>
            <div className="flex gap-2">
              {(["1k", "2k"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setWatermarkResolution(r)}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    watermarkResolution === r
                      ? "bg-orange-600/25 text-orange-200 border border-orange-500/35"
                      : "bg-white/5 text-white/50 border border-white/8"
                  }`}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

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
            <div className="rounded-xl border border-white/8 p-3">
              <p className="text-xs text-white/40 mb-2">去水印后</p>
              <div className="aspect-square rounded-lg bg-white/5 overflow-hidden flex items-center justify-center">
                {afterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={afterUrl} alt="去水印结果" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-white/25 text-xs bg-white/5 w-full h-full flex items-center justify-center rounded-lg">
                    {loading ? "处理中…" : "—"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {watermarkMessage && <p className="text-sm text-emerald-400/90 text-center">{watermarkMessage}</p>}
          {afterUrl && (
            <button
              type="button"
              onClick={handleDownloadWatermark}
              className="w-full rounded-xl border border-white/15 py-2.5 text-sm text-white/70 hover:text-white"
            >
              下载结果
            </button>
          )}
        </div>
      ) : tab === "beautify" ? (
        <div className="space-y-5">
          <label className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-8 cursor-pointer hover:border-white/25 hover:bg-white/[0.04] transition-all">
            {beforeUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={beforeUrl} alt="预览" className="max-h-40 rounded-lg object-contain" />
            ) : (
              <span className="text-3xl opacity-60">✧</span>
            )}
            <span className="text-sm text-white/50">{file?.name ?? "上传人像照片"}</span>
            <span className="text-xs text-white/25">自拍、证件照、写真均可 · 自动智能美颜</span>
            <input type="file" accept="image/*" className="hidden" onChange={onFile} />
          </label>

          <div>
            <label className="block text-sm text-white/60 mb-2">美颜强度</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {beautifyLevels.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setBeautifyLevel(l.id)}
                  className={`rounded-xl px-3 py-3 text-left transition-all ${
                    beautifyLevel === l.id
                      ? "bg-rose-600/25 text-rose-100 border border-rose-500/35"
                      : "bg-white/5 text-white/50 border border-white/8 hover:bg-white/10"
                  }`}
                >
                  <span className="block text-sm font-medium">{l.label}</span>
                  <span className="block text-[11px] opacity-70 mt-0.5">{l.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-2">输出清晰度</label>
            <div className="flex gap-2">
              {(["1k", "2k"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setBeautifyResolution(r)}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    beautifyResolution === r
                      ? "bg-rose-600/25 text-rose-200 border border-rose-500/35"
                      : "bg-white/5 text-white/50 border border-white/8"
                  }`}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

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
            <div className="rounded-xl border border-white/8 p-3">
              <p className="text-xs text-white/40 mb-2">美化后</p>
              <div className="aspect-square rounded-lg bg-white/5 overflow-hidden flex items-center justify-center">
                {afterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={afterUrl} alt="美化结果" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-white/25 text-xs bg-white/5 w-full h-full flex items-center justify-center rounded-lg">
                    {loading ? "美化中…" : "—"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {beautifyMessage && <p className="text-sm text-emerald-400/90 text-center">{beautifyMessage}</p>}
          {afterUrl && (
            <button
              type="button"
              onClick={handleDownloadBeautify}
              className="w-full rounded-xl border border-white/15 py-2.5 text-sm text-white/70 hover:text-white"
            >
              下载美化结果
            </button>
          )}
        </div>
      ) : tab === "edit" ? (
        <div className="space-y-5">
          <label className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-8 cursor-pointer hover:border-white/25 hover:bg-white/[0.04] transition-all">
            {beforeUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={beforeUrl} alt="预览" className="max-h-40 rounded-lg object-contain" />
            ) : (
              <span className="text-3xl opacity-60">✎</span>
            )}
            <span className="text-sm text-white/50">{file?.name ?? "上传待修图片"}</span>
            <span className="text-xs text-white/25">支持 JPG / PNG，宽高比 1:3 至 3:1</span>
            <input type="file" accept="image/*" className="hidden" onChange={onFile} />
          </label>

          <div>
            <label htmlFor="edit-prompt" className="block text-sm text-white/60 mb-2">
              修图指令
            </label>
            <textarea
              id="edit-prompt"
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="描述你想如何修改这张图片，例如：把背景换成海边日落"
              className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
            />
            <p className="mt-1 text-right text-xs text-white/25">{editPrompt.length} / 500</p>
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-2">快捷指令</label>
            <div className="flex flex-wrap gap-2">
              {editPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setEditPrompt(preset)}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    editPrompt === preset
                      ? "bg-amber-600/25 text-amber-200 border border-amber-500/35"
                      : "bg-white/5 text-white/50 border border-white/8"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-2">输出清晰度</label>
            <div className="flex gap-2">
              {(["1k", "2k"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setEditResolution(r)}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    editResolution === r
                      ? "bg-amber-600/25 text-amber-200 border border-amber-500/35"
                      : "bg-white/5 text-white/50 border border-white/8"
                  }`}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

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
            <div className="rounded-xl border border-white/8 p-3">
              <p className="text-xs text-white/40 mb-2">修图结果</p>
              <div className="aspect-square rounded-lg bg-white/5 overflow-hidden flex items-center justify-center">
                {afterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={afterUrl} alt="修图结果" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-white/25 text-xs bg-white/5 w-full h-full flex items-center justify-center rounded-lg">
                    {loading ? "修图中…" : "—"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {editMessage && <p className="text-sm text-emerald-400/90 text-center">{editMessage}</p>}
          {afterUrl && (
            <button
              type="button"
              onClick={handleDownloadEdit}
              className="w-full rounded-xl border border-white/15 py-2.5 text-sm text-white/70 hover:text-white"
            >
              下载修图结果
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
        <span className="text-xs text-white/25">压缩、清晰、抠图即时处理，注重隐私</span>
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

      {loadProgress && !["generate", "edit", "beautify", "watermark"].includes(tab) && (
        <p className="text-center text-xs text-violet-300/80 animate-pulse">{loadProgress}</p>
      )}
      {error && <p className="text-sm text-red-400/90 text-center leading-relaxed">{error}</p>}

      <ActionButton
        label={primaryLabel}
        loading={loading}
        loadingLabel={
          (tab === "cutout" || tab === "bgreplace") && loadProgress
            ? loadProgress
            : tab === "edit" && loading
              ? "AI 修图中，约需数秒…"
              : tab === "beautify" && loading
                ? "AI 人像美化中，约需数秒…"
                : tab === "watermark" && loading
                  ? "AI 去水印中，约需数秒…"
                  : tab === "bgreplace" && loading && bgMode === "ai"
                    ? "AI 换背景中，约需数秒…"
                    : undefined
        }
        disabled={primaryDisabled}
        onClick={primaryAction}
      />

      <p className="text-center text-xs text-white/25 leading-relaxed">
        {getImageStudioFooterHint(tab, bgMode, isAdmin)}
      </p>
    </div>
  );
}
