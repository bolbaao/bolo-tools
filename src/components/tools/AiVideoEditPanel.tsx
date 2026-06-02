"use client";

import ActionButton from "@/components/ActionButton";
import { useAgentPrefill } from "@/hooks/useAgentPrefill";
import { ApiError, apiGet, apiUploadBinary, downloadBlob } from "@/lib/api";
import { AI_SERVICE_UNAVAILABLE } from "@/lib/service-message";
import { useCallback, useEffect, useState } from "react";

type Mode = "edit" | "voiceover";

type EditOperation = { op: string; [key: string]: unknown };

type ClipMeta = {
  index: number;
  name: string;
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
};

type PlanResponse = {
  ok: boolean;
  summary: string;
  operations: EditOperation[];
  provider?: string;
  clipCount?: number;
  clips?: ClipMeta[];
  meta?: { duration: number; width: number; height: number; hasAudio: boolean };
};

type VoiceoverSegment = {
  text: string;
  clipIndex: number;
  clipStart: number;
  clipEnd: number;
  clipName?: string;
  matchReason?: string;
};

type VoiceoverPlanResponse = {
  ok: boolean;
  summary: string;
  voice: string;
  aspect: string;
  segments: VoiceoverSegment[];
  provider?: string;
  clips?: ClipMeta[];
};

type TtsVoice = { id: string; label: string };

const EDIT_EXAMPLES = [
  "去掉片头 3 秒，最后 1 秒淡出",
  "裁成 9:16 竖屏，宽度 720，加速 1.2 倍",
  "静音并压缩到 480p",
  "多段视频按顺序拼接，统一 720p 竖屏",
];

const VOICEOVER_EXAMPLES = [
  "产品介绍口播，匹配产品特写与使用画面",
  "知识科普，按段落匹配 B-roll 素材",
  "竖屏 9:16 短视频口播",
];

function appendVideos(fd: FormData, files: File[]) {
  for (const f of files) {
    fd.append("files", f);
  }
}

export default function AiVideoEditPanel() {
  const [mode, setMode] = useState<Mode>("edit");
  const [files, setFiles] = useState<File[]>([]);
  const [instruction, setInstruction] = useState("");
  const [script, setScript] = useState("");
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [ttsAvailable, setTtsAvailable] = useState<boolean | null>(null);
  const [ttsHint, setTtsHint] = useState<string | null>(null);
  const [voices, setVoices] = useState<TtsVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("zh-CN-XiaoxiaoNeural");
  const [maxDurationSec, setMaxDurationSec] = useState(300);
  const [maxVideoCount, setMaxVideoCount] = useState(10);
  const [hints, setHints] = useState<string[]>(EDIT_EXAMPLES);
  const [loading, setLoading] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [voiceoverPlan, setVoiceoverPlan] = useState<VoiceoverPlanResponse | null>(null);
  const [provider, setProvider] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{
      ok: boolean;
      aiConfigured: boolean;
      maxDurationSec: number;
      maxVideoCount?: number;
      hints?: string[];
      voiceoverHints?: string[];
      voiceover?: {
        ttsAvailable: boolean;
        hint?: string | null;
        voices?: TtsVoice[];
        defaultVoice?: string;
      };
    }>("/api/ai-video-edit/capabilities")
      .then((d) => {
        setAiConfigured(d.aiConfigured);
        setMaxDurationSec(d.maxDurationSec || 300);
        setMaxVideoCount(d.maxVideoCount || 10);
        setTtsAvailable(d.voiceover?.ttsAvailable ?? false);
        setTtsHint(d.voiceover?.hint ?? null);
        if (d.voiceover?.voices?.length) setVoices(d.voiceover.voices);
        if (d.voiceover?.defaultVoice) setSelectedVoice(d.voiceover.defaultVoice);
      })
      .catch(() => setAiConfigured(false));
  }, []);

  useEffect(() => {
    setHints(mode === "voiceover" ? VOICEOVER_EXAMPLES : EDIT_EXAMPLES);
    setError(null);
    setPlan(null);
    setVoiceoverPlan(null);
    setProvider(null);
  }, [mode]);

  const addFiles = (incoming: FileList | File[] | null) => {
    if (!incoming?.length) return;
    const list = Array.from(incoming);
    setFiles((prev) => {
      const merged = [...prev];
      for (const f of list) {
        if (merged.length >= maxVideoCount) break;
        if (!merged.some((x) => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified)) {
          merged.push(f);
        }
      }
      return merged.slice(0, maxVideoCount);
    });
    setError(null);
    setPlan(null);
    setVoiceoverPlan(null);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPlan(null);
    setVoiceoverPlan(null);
  };

  const loadScriptFile = (f: File | null) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setScript(String(reader.result ?? ""));
      setVoiceoverPlan(null);
      setError(null);
    };
    reader.readAsText(f, "utf-8");
  };

  const voiceoverReady =
    aiConfigured !== false && ttsAvailable !== false && files.length > 0 && script.trim().length > 0;

  const handleGeneratePlan = useCallback(async () => {
    if (!files.length || !instruction.trim()) return;
    setLoading(true);
    setError(null);
    setPlan(null);
    setProvider(null);
    try {
      const fd = new FormData();
      appendVideos(fd, files);
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
  }, [files, instruction]);

  const handleVoiceoverPlan = useCallback(async () => {
    if (!voiceoverReady) return;
    setLoading(true);
    setError(null);
    setVoiceoverPlan(null);
    setProvider(null);
    try {
      const fd = new FormData();
      appendVideos(fd, files);
      fd.append("script", script.trim());
      if (instruction.trim()) fd.append("instruction", instruction.trim());
      const res = await fetch("/api/ai-video-edit/voiceover/plan", {
        method: "POST",
        body: fd,
        signal: AbortSignal.timeout(120000),
      });
      const data = (await res.json()) as VoiceoverPlanResponse & { error?: string; ok?: boolean };
      if (!res.ok || data.ok === false) {
        throw new ApiError(data.error || "生成口播方案失败", res.status);
      }
      setVoiceoverPlan({ ...data, voice: selectedVoice || data.voice });
      setProvider(data.provider || null);
      if (data.voice) setSelectedVoice(data.voice);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "生成口播方案失败");
    } finally {
      setLoading(false);
    }
  }, [voiceoverReady, files, script, instruction, selectedVoice]);

  useAgentPrefill("ai-video-edit", {
    apply: (fields) => {
      if (fields.mode === "edit" || fields.mode === "voiceover") setMode(fields.mode);
      if (fields.instruction) setInstruction(fields.instruction);
      if (fields.prompt) setInstruction(fields.prompt);
      if (fields.script) setScript(fields.script);
    },
    canSubmit: (fields) => {
      if (!files.length) return false;
      if (fields.mode === "voiceover") return Boolean(fields.script?.trim());
      return Boolean((fields.instruction || fields.prompt)?.trim());
    },
    submit: (fields) => {
      if (fields.mode === "voiceover") void handleVoiceoverPlan();
      else void handleGeneratePlan();
    },
  });

  const handleRender = async () => {
    if (!files.length || !plan) return;
    setRendering(true);
    setError(null);
    try {
      const fd = new FormData();
      appendVideos(fd, files);
      fd.append("plan", JSON.stringify({ summary: plan.summary, operations: plan.operations }));
      const { blob, filename } = await apiUploadBinary("/api/ai-video-edit/render", fd, {
        timeoutMs: 300000,
      });
      const name =
        filename ||
        (files.length > 1 ? "merged_edited.mp4" : `${files[0].name.replace(/\.[^.]+$/, "")}_edited.mp4`);
      downloadBlob(blob, name, "video/mp4");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "视频渲染失败");
    } finally {
      setRendering(false);
    }
  };

  const handleVoiceoverRender = async () => {
    if (!files.length || !voiceoverPlan) return;
    setRendering(true);
    setError(null);
    try {
      const fd = new FormData();
      appendVideos(fd, files);
      fd.append("script", script.trim());
      fd.append(
        "plan",
        JSON.stringify({
          summary: voiceoverPlan.summary,
          voice: selectedVoice || voiceoverPlan.voice,
          aspect: voiceoverPlan.aspect,
          segments: voiceoverPlan.segments,
        }),
      );
      const { blob, filename } = await apiUploadBinary("/api/ai-video-edit/voiceover/render", fd, {
        timeoutMs: 600000,
      });
      downloadBlob(blob, filename || "voiceover.mp4", "video/mp4");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "口播成片渲染失败");
    } finally {
      setRendering(false);
    }
  };

  const handleOneStep = async () => {
    if (!files.length || !instruction.trim()) return;
    setRendering(true);
    setError(null);
    setPlan(null);
    try {
      const fd = new FormData();
      appendVideos(fd, files);
      fd.append("instruction", instruction.trim());
      const { blob, filename } = await apiUploadBinary("/api/ai-video-edit/edit", fd, {
        timeoutMs: 300000,
      });
      const name =
        filename ||
        (files.length > 1 ? "merged_edited.mp4" : `${files[0].name.replace(/\.[^.]+$/, "")}_edited.mp4`);
      downloadBlob(blob, name, "video/mp4");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "剪辑失败");
    } finally {
      setRendering(false);
    }
  };

  const handleVoiceoverOneStep = async () => {
    if (!voiceoverReady) return;
    setRendering(true);
    setError(null);
    setVoiceoverPlan(null);
    try {
      const fd = new FormData();
      appendVideos(fd, files);
      fd.append("script", script.trim());
      if (instruction.trim()) fd.append("instruction", instruction.trim());
      const { blob, filename } = await apiUploadBinary("/api/ai-video-edit/voiceover/edit", fd, {
        timeoutMs: 600000,
      });
      downloadBlob(blob, filename || "voiceover.mp4", "video/mp4");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "口播剪辑失败");
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
      <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
        <button
          type="button"
          onClick={() => setMode("edit")}
          className={`flex-1 rounded-lg py-2.5 text-sm transition-colors ${
            mode === "edit"
              ? "bg-violet-500/25 text-white"
              : "text-white/50 hover:text-white/75"
          }`}
        >
          智能剪辑
        </button>
        <button
          type="button"
          onClick={() => setMode("voiceover")}
          className={`flex-1 rounded-lg py-2.5 text-sm transition-colors ${
            mode === "voiceover"
              ? "bg-violet-500/25 text-white"
              : "text-white/50 hover:text-white/75"
          }`}
        >
          AI 剪口播
        </button>
      </div>

      <div className="rounded-2xl border border-violet-500/15 bg-violet-500/5 px-5 py-4">
        {mode === "edit" ? (
          <p className="text-sm text-white/70 leading-relaxed">
            用大白话说明想怎么剪，AI 会给出剪辑方案并在本机生成视频，也支持多段视频按顺序拼接。
          </p>
        ) : (
          <p className="text-sm text-white/70 leading-relaxed">
            上传口播稿和多段视频，AI 会为每段文案匹配画面并配上旁白，合成完整口播视频。
          </p>
        )}
        {aiConfigured === false && (
          <p className="mt-2 text-sm text-amber-400/90">{AI_SERVICE_UNAVAILABLE}</p>
        )}
        {mode === "voiceover" && ttsAvailable === false && (
          <p className="mt-2 text-sm text-amber-400/90">
            {ttsHint || "人声合成未就绪，请安装 edge-tts 后重启服务"}
          </p>
        )}
        <p className="mt-2 text-xs text-white/35">
          {mode === "edit"
            ? `最多 ${maxVideoCount} 个视频，合计建议 ≤ ${maxDurationSec} 秒`
            : `素材最多 ${maxVideoCount} 个；文稿与画面在本地处理，AI 仅用于匹配方案`}
        </p>
      </div>

      <label className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-8 cursor-pointer hover:border-violet-500/35 hover:bg-violet-500/5 transition-all">
        <span className="text-3xl opacity-60">{mode === "voiceover" ? "📁" : "🎬"}</span>
        <span className="text-sm text-white/50">
          {files.length
            ? `已选 ${files.length} 个${mode === "voiceover" ? "素材" : "视频"}`
            : mode === "voiceover"
              ? "上传视频素材（可多选）"
              : "上传待剪辑视频（可多选）"}
        </span>
        <input
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {files.length > 0 && (
        <ul className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${f.size}-${f.lastModified}`}
              className="flex items-center justify-between gap-3 text-sm text-white/70"
            >
              <span className="truncate">
                <span className="text-violet-400/80 font-mono text-xs mr-2">{i + 1}</span>
                {f.name}
              </span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="shrink-0 text-xs text-white/40 hover:text-red-400/90"
              >
                移除
              </button>
            </li>
          ))}
        </ul>
      )}

      {mode === "voiceover" && (
        <>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="ai-vo-script" className="text-sm text-white/60">
                口播文稿
              </label>
              <label className="text-xs text-violet-300/80 cursor-pointer hover:text-violet-300">
                上传 .txt / .md
                <input
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
                  className="hidden"
                  onChange={(e) => {
                    loadScriptFile(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <textarea
              id="ai-vo-script"
              rows={8}
              value={script}
              onChange={(e) => {
                setScript(e.target.value);
                setVoiceoverPlan(null);
              }}
              placeholder="粘贴完整口播稿。AI 将按句拆分，并为每段匹配最合适的素材片段…"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 resize-y min-h-[160px]"
            />
          </div>
          {voices.length > 0 && (
            <div>
              <label htmlFor="ai-vo-voice" className="block text-sm text-white/60 mb-2">
                人声音色
              </label>
              <select
                id="ai-vo-voice"
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white"
              >
                {voices.map((v) => (
                  <option key={v.id} value={v.id} className="bg-zinc-900">
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      <div>
        <label htmlFor="ai-video-instruction" className="block text-sm text-white/60 mb-2">
          {mode === "voiceover" ? "匹配要求（可选）" : "剪辑描述"}
        </label>
        <textarea
          id="ai-video-instruction"
          rows={mode === "voiceover" ? 2 : 4}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder={
            mode === "voiceover"
              ? "例如：优先产品特写、竖屏 9:16"
              : "例如：去掉前 5 秒，裁成竖屏 9:16，最后 1 秒淡出"
          }
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 resize-y min-h-[80px]"
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

      {mode === "edit" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <ActionButton
            label="生成剪辑方案"
            loadingLabel="AI 解析中…"
            loading={loading}
            disabled={!files.length || !instruction.trim() || aiConfigured === false}
            onClick={handleGeneratePlan}
            variant="secondary"
          />
          <ActionButton
            label="一键剪辑并下载"
            loadingLabel="剪辑渲染中…"
            loading={rendering}
            disabled={!files.length || !instruction.trim() || aiConfigured === false}
            onClick={handleOneStep}
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <ActionButton
            label="生成匹配方案"
            loadingLabel="AI 匹配素材中…"
            loading={loading}
            disabled={!voiceoverReady}
            onClick={handleVoiceoverPlan}
            variant="secondary"
          />
          <ActionButton
            label="一键口播成片"
            loadingLabel="合成渲染中…"
            loading={rendering}
            disabled={!voiceoverReady}
            onClick={handleVoiceoverOneStep}
          />
        </div>
      )}

      {mode === "edit" && plan && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
          <div>
            <p className="text-xs text-white/40 mb-1">方案摘要</p>
            <p className="text-sm text-white/85">{plan.summary}</p>
            {provider && <p className="text-xs text-white/30 mt-1">解析引擎：{provider}</p>}
          </div>
          {plan.meta && (
            <p className="text-xs text-white/35">
              {plan.clipCount && plan.clipCount > 1 ? "拼接后 " : ""}
              {plan.meta.width}×{plan.meta.height} · {plan.meta.duration.toFixed(1)}s
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
            disabled={!files.length}
            onClick={handleRender}
          />
        </div>
      )}

      {mode === "voiceover" && voiceoverPlan && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
          <div>
            <p className="text-xs text-white/40 mb-1">匹配摘要</p>
            <p className="text-sm text-white/85">{voiceoverPlan.summary}</p>
            {provider && <p className="text-xs text-white/30 mt-1">解析引擎：{provider}</p>}
            <p className="text-xs text-white/35 mt-1">
              画幅 {voiceoverPlan.aspect} · 共 {voiceoverPlan.segments.length} 段 · 将合成人声
            </p>
          </div>
          <ol className="space-y-3 max-h-80 overflow-y-auto">
            {voiceoverPlan.segments.map((seg, i) => (
              <li
                key={`vo-${i}`}
                className="rounded-lg bg-white/[0.03] px-3 py-2.5 space-y-1"
              >
                <div className="flex gap-2 text-sm text-white/80">
                  <span className="text-violet-400/80 font-mono text-xs shrink-0 pt-0.5">
                    {i + 1}
                  </span>
                  <span>{seg.text}</span>
                </div>
                <p className="text-xs text-white/40 pl-5">
                  素材 #{seg.clipIndex + 1}
                  {seg.clipName ? ` ${seg.clipName}` : ""} · {seg.clipStart.toFixed(1)}s–
                  {seg.clipEnd.toFixed(1)}s
                  {seg.matchReason ? ` · ${seg.matchReason}` : ""}
                </p>
              </li>
            ))}
          </ol>
          <ActionButton
            label="确认方案并合成下载"
            loadingLabel="人声+画面合成中…"
            loading={rendering}
            disabled={!files.length}
            onClick={handleVoiceoverRender}
          />
        </div>
      )}
    </div>
  );
}
