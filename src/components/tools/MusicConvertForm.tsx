"use client";

import MockButton from "@/components/MockButton";
import { useState } from "react";

const formats = ["MP3", "WAV", "FLAC", "AAC", "OGG"];

export default function MusicConvertForm() {
  const [targetFormat, setTargetFormat] = useState("MP3");
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileName(file ? file.name : null);
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm text-white/60 mb-2">上传音频文件</label>
        <label className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 cursor-pointer hover:border-violet-500/40 hover:bg-violet-500/5 transition-all">
          <span className="text-3xl opacity-60">♪</span>
          <span className="text-sm text-white/50">
            {fileName ?? "点击或拖拽文件到此处"}
          </span>
          <span className="text-xs text-white/25">支持 MP3 / WAV / FLAC 等</span>
          <input type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />
        </label>
      </div>

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

      <MockButton
        label={`转换为 ${targetFormat}`}
        successMessage={`已模拟转换为 ${targetFormat} 格式（演示）`}
      />
    </div>
  );
}
