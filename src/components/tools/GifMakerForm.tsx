"use client";

import ActionButton from "@/components/ActionButton";
import FileDropZone from "@/components/FileDropZone";
import { ToolError, ToolPresetCard, ToolPresetGrid, ToolSection } from "@/components/tools/ToolSection";
import { ApiError, apiUpload, downloadBlob } from "@/lib/api";
import { useAgentPrefill } from "@/hooks/useAgentPrefill";
import { useEffect, useMemo, useRef, useState } from "react";

const PRESETS = [
  { label: "表情包", width: "320", fps: "12", duration: "3" },
  { label: "标准", width: "480", fps: "10", duration: "5" },
  { label: "高清", width: "720", fps: "15", duration: "5" },
  { label: "省体积", width: "400", fps: "8", duration: "4" },
] as const;

export default function GifMakerForm() {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [start, setStart] = useState("0");
  const [duration, setDuration] = useState("3");
  const [fps, setFps] = useState("10");
  const [width, setWidth] = useState("480");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const frameCount = useMemo(() => {
    const d = Math.min(30, Math.max(0.5, Number(duration) || 0));
    const f = Math.max(5, Math.min(20, Number(fps) || 10));
    return Math.round(d * f);
  }, [duration, fps]);

  useEffect(() => {
    if (!file) {
      setVideoUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useAgentPrefill("gif-maker", {
    apply: (fields) => {
      if (fields.start) setStart(fields.start);
      if (fields.duration) setDuration(fields.duration);
      if (fields.fps) setFps(fields.fps);
      if (fields.width) setWidth(fields.width);
    },
  });

  const handleGenerate = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("start", start);
      fd.append("duration", duration);
      fd.append("fps", fps);
      fd.append("width", width);
      const blob = await apiUpload("/api/gif/from-video", fd, { timeoutMs: 120000 });
      if (!(blob instanceof Blob)) throw new Error("生成失败");
      const name = `${file.name.replace(/\.[^.]+$/, "")}.gif`;
      downloadBlob(blob, name);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "GIF 生成失败");
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setWidth(preset.width);
    setFps(preset.fps);
    setDuration(preset.duration);
  };

  const seekToStart = () => {
    const v = videoRef.current;
    if (!v) return;
    const t = Math.max(0, Number(start) || 0);
    v.currentTime = t;
  };

  return (
    <div className="space-y-6">
      <FileDropZone
        icon="🎞"
        accept="video/*"
        title={file?.name ?? "点击上传视频 或 拖拽到此处"}
        hint="MP4 / MOV，建议片段 ≤ 30 秒"
        onFiles={(files) => {
          setFile(files[0] ?? null);
          setError(null);
        }}
      />

      {videoUrl && (
        <div className="space-y-2">
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            className="w-full max-h-56 rounded-xl border border-white/10 bg-black/40"
            onLoadedMetadata={seekToStart}
          />
          <button
            type="button"
            onClick={seekToStart}
            className="text-xs text-amber-300/80 hover:text-amber-200 underline-offset-2 hover:underline"
          >
            跳转到起始时间 {start}s
          </button>
        </div>
      )}

      <div className="tool-form-row tool-form-row--2">
        <div>
          <label htmlFor="gif-start" className="block text-sm text-white/60 mb-2">
            起始时间（秒）
          </label>
          <input
            id="gif-start"
            type="number"
            min={0}
            step={0.1}
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label htmlFor="gif-duration" className="block text-sm text-white/60 mb-2">
            时长（秒，最长 30）
          </label>
          <input
            id="gif-duration"
            type="number"
            min={0.5}
            max={30}
            step={0.5}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          />
        </div>
      </div>

      <div>
        <label htmlFor="gif-fps" className="block text-sm text-white/60 mb-2">
          帧率：{fps} fps
        </label>
        <input
          id="gif-fps"
          type="range"
          min={5}
          max={20}
          value={fps}
          onChange={(e) => setFps(e.target.value)}
          className="w-full accent-amber-500"
        />
      </div>

      <div>
        <label htmlFor="gif-width" className="block text-sm text-white/60 mb-2">
          宽度：{width}px
        </label>
        <input
          id="gif-width"
          type="range"
          min={240}
          max={960}
          step={40}
          value={width}
          onChange={(e) => setWidth(e.target.value)}
          className="w-full accent-amber-500"
        />
      </div>

      <p className="text-center text-xs text-white/35">
        预计约 {frameCount} 帧 · 帧率越高、时长越长，文件越大
      </p>

      {error && <ToolError>{error}</ToolError>}

      <ActionButton
        label="生成 GIF"
        loading={loading}
        disabled={!file}
        onClick={handleGenerate}
      />

      <ToolSection title="快捷预设">
        <ToolPresetGrid>
          {PRESETS.map((p) => (
            <ToolPresetCard
              key={p.label}
              title={p.label}
              desc={`${p.width}px · ${p.fps}fps · ${p.duration}s`}
              onClick={() => applyPreset(p)}
            />
          ))}
        </ToolPresetGrid>
      </ToolSection>
    </div>
  );
}
