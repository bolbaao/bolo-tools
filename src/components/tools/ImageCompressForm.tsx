"use client";

import MockButton from "@/components/MockButton";
import { useState } from "react";

const formats = ["JPG", "PNG", "WebP"];

export default function ImageCompressForm() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [quality, setQuality] = useState("75");
  const [format, setFormat] = useState("WebP");

  const mockBefore = fileName ? "2.4 MB" : "—";
  const mockAfter = fileName ? `${(2.4 * (Number(quality) / 100) * 0.35).toFixed(1)} MB` : "—";

  return (
    <div className="space-y-6">
      <label className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 cursor-pointer hover:border-lime-500/35 hover:bg-lime-500/5 transition-all">
        <span className="text-3xl opacity-60">◐</span>
        <span className="text-sm text-white/50">{fileName ?? "上传待压缩图片"}</span>
        <span className="text-xs text-white/25">单张最大 20MB · 支持批量（演示）</span>
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
      </label>

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
        <p className="mt-1 text-xs text-white/30">数值越低体积越小，画质损失越多</p>
      </div>

      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 flex justify-between text-sm">
        <div>
          <p className="text-white/40 text-xs">压缩前</p>
          <p className="text-white/80 mt-1">{mockBefore}</p>
        </div>
        <div className="text-white/20">→</div>
        <div className="text-right">
          <p className="text-white/40 text-xs">预计压缩后</p>
          <p className="text-lime-300 mt-1">{mockAfter}</p>
        </div>
      </div>

      <MockButton
        label={`压缩并导出 ${format}`}
        successMessage={`已压缩为 ${format} 格式（演示）`}
      />
    </div>
  );
}
