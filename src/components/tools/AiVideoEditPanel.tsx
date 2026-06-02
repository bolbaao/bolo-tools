"use client";

import ActionButton from "@/components/ActionButton";
import { useAgentPrefill } from "@/hooks/useAgentPrefill";
import { ApiError, apiGet, apiUploadBinary, downloadBlob } from "@/lib/api";
import { AI_SERVICE_UNAVAILABLE } from "@/lib/service-message";
import { useCallback, useEffect, useState } from "react";

type EditOperation = { op: string; [key: string]: unknown };

type PlanResponse = {
  ok: boolean;
  summary: string;
  operations: EditOperation[];
  provider?: string;
  meta?: { duration: number; width: number; height: number; hasAudio: boolean };
};

const EXAMPLES = [
  "去掉片头 3 秒，最后 1 秒淡出",
  "裁成 9:16 竖屏，宽度 720，加速 1.2 倍",
  "静音并压缩到 480p",
  "保留 10 秒到 40 秒片段，对比度略提高",
];

export default function AiVideoEditPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [instruction, setInstruction] = useState("");
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [maxDurationSec, setMaxDurationSec] = useState(300);
  const [hints, setHints] = useState<string[]>(EXAMPLES);
  const [loading, setLoading] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [provider, setProvider] = useState<string | null>(null);

  const applyPrefill = useCallback((fields: Record<string, string>) => {
    if (fields.instruction) setInstruction(fields.instruction);
    if (fields.prompt) setInstruction(fields.prompt);
  }, []);
  useAgentPrefill("ai-video-edit", applyPrefill);

  useEffect(() => {
    apiGet<{
      ok: boolean;
      aiConfigured: boolean;
      maxDurationSec: number;
      hints?: string[];
    }>("/api/ai-video-edit/capabilities")
      .then((d) => {
        setAiConfigured(d.aiConfigured);
        setMaxDurationSec(d.maxDurationSec || 300);
        if (d.hints?.length) setHints(d.hints);
      })
      .catch(() => setAiConfigured(false));
  }, []);

  const handleGeneratePlan = async () => {
    if (!file || !instruction.trim()) return;
    setLoading(true);
    setError(null);
    setPlan(null);
    setProvider(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("instruction", instruction.trim());
      const res = await fetch("/api/ai-video-edit/plan", {
        method: "POST",
        body: fd,
        signal: AbortSignal.timeout(120000),
      });
      const data = (await res.json()) as PlanResponse & { error?: string; ok?: boolean };
      if (!res.ok || data.ok === false) {
        throw new ApiError(data.error || "生成方案失败", res.status);
      }
      setPlan(data);
      setProvider(data.provider || null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "生成剪辑方案失败");
    } finally {
      setLoading(false);
    }
  };

  const handleRender = async () => {
    if (!file || !plan) return;
    setRendering(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append(
        "plan",
        JSON.stringify({ summary: plan.summary, operations: plan.operations }),
      );
      const { blob, filename } = await apiUploadBinary("/api/ai-video-edit/render", fd, {
        timeoutMs: 300000,
      });
      const name =
        filename || `${file.name.replace(/\.[^.]+$/, "")}_edited.mp4`;
      downloadBlob(blob, name, "video/mp4");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "视频渲染失败");
    } finally {
      setRendering(false);
    }
  };

  const handleOneStep = async () => {
    if (!file || !instruction.trim()) return;
    setRendering(true);
    setError(null);
    setPlan(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("instruction", instruction.trim());
      const { blob, filename } = await apiUploadBinary("/api/ai-video-edit/edit", fd, {
        timeoutMs: 300000,
      });
      const name =
        filename || `${file.name.replace(/\.[^.]+$/, "")}_edited.mp4`;
      downloadBlob(blob, name, "video/mp4");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "剪辑失败");
    } finally {
      setRendering(false);
    }
  };

  const opLabel = (op: EditOperation) => {
    switch (op.op) {
      case "trim":
        return `裁剪 ${String(op.start ?? 0)}s – ${String(op.end ?? "?")}s`;
      case "crop_aspect":
        return `画幅 ${String(op.aspect)}`;
      case "scale":
        return op.width ? `宽度 ${op.width}px` : `最大宽 ${op.maxWidth}px`;
      case "speed":
        return `变速 ×${op.factor}`;
      case "rotate":
        return `旋转 ${op.degrees}°`;
      case "flip":
        return op.axis === "vertical" ? "垂直翻转" : "水平翻转";
      case "brightness":
        return `亮度 ${op.value}`;
      case "contrast":
        return `对比度 ${op.value}`;
      case "volume":
        return `音量 ${Math.round(Number(op.level) * 100)}%`;
      case "remove_audio":
        return "去除音轨";
      case "fade":
        return `淡入淡出 (${op.type}, ${op.duration}s)`;
      default:
        return op.op;
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-violet-500/15 bg-violet-500/5 px-5 py-4">
        <p className="text-sm text-white/70 leading-relaxed">
          用自然语言描述剪辑需求，AI 会生成可执行的 ffmpeg 方案；确认后再渲染导出 MP4。
          需配置 <span className="text-violet-300">DEEPSEEK_API_KEY</span> 或{" "}
          <span className="text-violet-300">ARK_API_KEY</span>，本机需已安装 ffmpeg。
        </p>
        {aiConfigured === false && (
          <p className="mt-2 text-sm text-amber-400/90">{AI_SERVICE_UNAVAILABLE}</p>
        )}
        <p className="mt-2 text-xs text-white/35">
          单文件建议 ≤ {maxDurationSec} 秒；处理在本地服务器完成，不会上传到第三方（AI 仅接收文字描述与时长分辨率）。
        </p>
      </div>

      <label className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-8 cursor-pointer hover:border-violet-500/35 hover:bg-violet-500/5 transition-all">
        <span className="text-3xl opacity-60">🎬</span>
        <span className="text-sm text-white/50">{file?.name ?? "上传待剪辑视频"}</span>
        <span className="text-xs text-white/25">MP4 / MOV / WebM 等，建议 ≤ {maxDurationSec} 秒</span>
        <input
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError(null);
            setPlan(null);
          }}
        />
      </label>

      <div>
        <label htmlFor="ai-video-instruction" className="block text-sm text-white/60 mb-2">
          剪辑描述
        </label>
        <textarea
          id="ai-video-instruction"
          rows={4}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="例如：去掉前 5 秒，裁成竖屏 9:16，最后 1 秒淡出"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 resize-y min-h-[100px]"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {hints.map((hint) => (
          <button
            key={hint}
            type="button"
            onClick={() => setInstruction(hint)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/55 hover:border-violet-500/30 hover:text-white/80 transition-colors"
          >
            {hint}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-400/90 text-center">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <ActionButton
          label="生成剪辑方案"
          loadingLabel="AI 解析中…"
          loading={loading}
          disabled={!file || !instruction.trim() || aiConfigured === false}
          onClick={handleGeneratePlan}
          variant="secondary"
        />
        <ActionButton
          label="一键剪辑并下载"
          loadingLabel="剪辑渲染中…"
          loading={rendering}
          disabled={!file || !instruction.trim() || aiConfigured === false}
          onClick={handleOneStep}
        />
      </div>

      {plan && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
          <div>
            <p className="text-xs text-white/40 mb-1">方案摘要</p>
            <p className="text-sm text-white/85">{plan.summary}</p>
            {provider && (
              <p className="text-xs text-white/30 mt-1">解析引擎：{provider}</p>
            )}
          </div>
          {plan.meta && (
            <p className="text-xs text-white/35">
              源视频 {plan.meta.width}×{plan.meta.height} · {plan.meta.duration.toFixed(1)}s
              {plan.meta.hasAudio ? " · 含音频" : " · 无音频"}
            </p>
          )}
          <ol className="space-y-2">
            {plan.operations.map((op, i) => (
              <li
                key={`${op.op}-${i}`}
                className="flex gap-3 text-sm text-white/70 rounded-lg bg-white/[0.03] px-3 py-2"
              >
                <span className="text-violet-400/80 font-mono text-xs pt-0.5">{i + 1}</span>
                <span>{opLabel(op)}</span>
              </li>
            ))}
          </ol>
          <ActionButton
            label="确认方案并渲染下载"
            loadingLabel="ffmpeg 渲染中…"
            loading={rendering}
            disabled={!file}
            onClick={handleRender}
          />
        </div>
      )}

      <p className="text-center text-xs text-white/25">
        推荐先「生成方案」核对步骤，再渲染；「一键剪辑」适合简单需求
      </p>
    </div>
  );
}
