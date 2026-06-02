"use client";

import ActionButton from "@/components/ActionButton";
import { useAgentPrefill } from "@/hooks/useAgentPrefill";
import { ApiError, apiGet, apiUpload, downloadBlob } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

type MlsharpStatus = {
  available: boolean;
  installed?: boolean;
  runtimeReady?: boolean;
  renderSupported?: boolean;
  hint?: string | null;
};

type QualityId = "standard" | "high" | "ultra";

type QualityPreset = { id: QualityId; label: string; internalSize: number };

const QUALITY_HINTS: Record<QualityId, string> = {
  standard: "速度最快，适合预览",
  high: "细节更好，耗时与内存略增",
  ultra: "最强预处理 + 2048 推理，最慢，建议主体清晰的照片",
};

export default function Mlsharp3DPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [render, setRender] = useState(false);
  const [quality, setQuality] = useState<QualityId>("standard");
  const [qualityPresets, setQualityPresets] = useState<QualityPreset[]>([
    { id: "standard", label: "标准", internalSize: 1536 },
    { id: "high", label: "高清", internalSize: 2048 },
    { id: "ultra", label: "超清", internalSize: 2048 },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<MlsharpStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiGet<
          MlsharpStatus & { ok?: boolean; qualityPresets?: QualityPreset[] }
        >("/api/mlsharp-3d/status");
        if (!cancelled) {
          setStatus({
            available: data.available,
            installed: data.installed,
            runtimeReady: data.runtimeReady,
            renderSupported: data.renderSupported,
            hint: data.hint,
          });
          if (data.qualityPresets?.length) setQualityPresets(data.qualityPresets as QualityPreset[]);
        }
      } catch {
        if (!cancelled) {
          setStatus({
            available: false,
            hint: "无法检测 3D 生成服务，请确认服务已启动",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleGenerate = useCallback(async () => {
    if (!file || !status?.available) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("quality", quality);
      if (render) fd.append("render", "1");
      const blob = await apiUpload("/api/mlsharp-3d/generate", fd, { timeoutMs: 600_000 });
      if (!(blob instanceof Blob)) throw new Error("生成失败");
      const base = file.name.replace(/\.[^.]+$/, "") || "model";
      const ext = render && blob.type.includes("zip") ? "zip" : "ply";
      downloadBlob(blob, `${base}-3d.${ext}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "3D 模型生成失败");
    } finally {
      setLoading(false);
    }
  }, [file, render, quality, status?.available]);

  useAgentPrefill("mlsharp-3d", {
    apply: (fields) => {
      if (fields.render === "1" || fields.render === "true") setRender(true);
      const q = fields.quality as QualityId;
      if (q === "standard" || q === "high" || q === "ultra") setQuality(q);
    },
  });

  const ready = status?.available;

  return (
    <>
      {status && !status.available && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
          <p className="font-medium text-amber-50/95">
            {status.installed && !status.runtimeReady
              ? "3D 生成功能正在初始化"
              : "3D 生成功能暂不可用"}
          </p>
          <p className="mt-1 text-amber-100/75">
            {status.hint || "请稍后再试，或联系站点管理员"}
          </p>
        </div>
      )}

      <label
        className={`flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-8 transition-all ${
          ready
            ? "border-white/15 bg-white/[0.02] cursor-pointer hover:border-violet-500/35 hover:bg-violet-500/5"
            : "border-white/10 bg-white/[0.01] cursor-not-allowed opacity-60"
        }`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="预览" className="max-h-48 rounded-lg object-contain" />
        ) : (
          <span className="text-3xl opacity-60">🧊</span>
        )}
        <span className="text-sm text-white/50">{file?.name ?? "上传一张照片"}</span>
        <span className="text-xs text-white/25 text-center">
          JPG / PNG / WebP，单张即可生成 3D Gaussian Splatting 模型（.ply）
        </span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={!ready}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError(null);
          }}
        />
      </label>

      <div>
        <p className="text-sm text-white/60 mb-2">精细度</p>
        <div className="grid grid-cols-3 gap-2">
          {qualityPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={!ready}
              onClick={() => setQuality(preset.id)}
              className={`rounded-xl border px-3 py-2 text-left transition-all ${
                quality === preset.id
                  ? "border-violet-500/50 bg-violet-500/15 text-white"
                  : "border-white/10 bg-white/[0.02] text-white/70 hover:border-white/20"
              } ${!ready ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span className="block text-sm font-medium">{preset.label}</span>
              <span className="block text-[11px] text-white/40 mt-0.5">
                {preset.internalSize}px · {QUALITY_HINTS[preset.id]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {status?.renderSupported && (
        <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 cursor-pointer">
          <input
            type="checkbox"
            checked={render}
            onChange={(e) => setRender(e.target.checked)}
            className="mt-1 accent-violet-500"
            disabled={!ready}
          />
          <span className="text-sm text-white/70">
            <span className="text-white/90">同时生成环绕预览视频</span>
            <span className="block text-xs text-white/40 mt-1">
              耗时更长，下载为 zip（含 .ply 与 .mp4）。Apple Silicon 或 NVIDIA GPU 可用。
            </span>
          </span>
        </label>
      )}

      {error ? (
        <p className="text-center text-sm text-red-400/90" data-tool-result>
          {error}
        </p>
      ) : null}

      <ActionButton
        label={render ? "生成 3D 模型与预览" : "生成 3D 模型并下载"}
        loading={loading}
        disabled={!file || !ready}
        onClick={handleGenerate}
      />

      <p className="text-center text-xs text-white/25 leading-relaxed">
        建议上传主体清晰、光线均匀的照片；精细度越高，细节越好，但耗时也更长。
      </p>
    </>
  );
}
