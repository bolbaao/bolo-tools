"use client";

import ActionButton from "@/components/ActionButton";
import { ApiError, apiUpload, downloadBlob } from "@/lib/api";
import { useState } from "react";

export default function GifMakerForm() {
  const [file, setFile] = useState<File | null>(null);
  const [start, setStart] = useState("0");
  const [duration, setDuration] = useState("3");
  const [fps, setFps] = useState("10");
  const [width, setWidth] = useState("480");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <label className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-8 cursor-pointer hover:border-amber-500/35 hover:bg-amber-500/5 transition-all">
        <span className="text-3xl opacity-60">🎞</span>
        <span className="text-sm text-white/50">{file?.name ?? "上传视频片段"}</span>
        <span className="text-xs text-white/25">MP4 / MOV / WebM 等，建议片段 ≤ 30 秒</span>
        <input
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError(null);
          }}
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
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

      {error && <p className="text-sm text-red-400/90 text-center">{error}</p>}

      <ActionButton
        label="生成 GIF 并下载"
        loading={loading}
        disabled={!file}
        onClick={handleGenerate}
      />
      <p className="text-center text-xs text-white/25">服务端 ffmpeg 处理，需已安装 ffmpeg</p>
    </div>
  );
}
