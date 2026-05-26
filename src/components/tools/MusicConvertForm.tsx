"use client";

import ActionButton from "@/components/ActionButton";
import { ApiError, apiUpload, downloadBlob } from "@/lib/api";
import { useState } from "react";

const formats = ["MP3", "WAV", "FLAC", "AAC", "OGG"];

export default function MusicConvertForm() {
  const [targetFormat, setTargetFormat] = useState("MP3");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConvert = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("format", targetFormat);
      const blob = await apiUpload<Blob>("/api/audio/convert", fd);
      if (!(blob instanceof Blob)) throw new Error("转换失败");
      const ext = targetFormat.toLowerCase();
      const base = file.name.replace(/\.[^.]+$/, "");
      downloadBlob(blob, `${base}.${ext}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "转换失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <label className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 cursor-pointer hover:border-violet-500/40 hover:bg-violet-500/5 transition-all">
        <span className="text-3xl opacity-60">♪</span>
        <span className="text-sm text-white/50">{file?.name ?? "点击上传音频文件"}</span>
        <input
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError(null);
          }}
        />
      </label>

      <div>
        <label className="block text-sm text-white/60 mb-2">目标格式</label>
        <div className="flex flex-wrap gap-2">
          {formats.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setTargetFormat(f)}
              className={`rounded-lg px-4 py-2 text-sm transition-all ${
                targetFormat === f
                  ? "bg-violet-600/30 text-violet-200 border border-violet-500/40"
                  : "bg-white/5 text-white/50 border border-white/8 hover:bg-white/10"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-400/90 text-center">{error}</p>}

      <ActionButton
        label={`转换为 ${targetFormat} 并下载`}
        loading={loading}
        disabled={!file}
        onClick={handleConvert}
      />
      <p className="text-center text-xs text-white/25">
        服务端使用 ffmpeg 转换 · 需本机安装 ffmpeg · 单文件最大 50MB
      </p>
    </div>
  );
}
