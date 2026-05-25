"use client";

import MockButton from "@/components/MockButton";
import { useState } from "react";

const levels = [
  { id: "light", label: "轻度增强" },
  { id: "standard", label: "标准清晰" },
  { id: "strong", label: "强力修复" },
];

export default function ImageSharpenForm() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [level, setLevel] = useState("standard");
  const [preview, setPreview] = useState(false);

  return (
    <div className="space-y-6">
      <label className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 cursor-pointer hover:border-sky-500/40 hover:bg-sky-500/5 transition-all">
        <span className="text-3xl opacity-60">◇</span>
        <span className="text-sm text-white/50">{fileName ?? "上传需要增强的图片"}</span>
        <span className="text-xs text-white/25">支持 JPG / PNG / WebP</span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            setFileName(e.target.files?.[0]?.name ?? null);
            setPreview(false);
          }}
        />
      </label>

      <div>
        <label className="block text-sm text-white/60 mb-2">增强强度</label>
        <div className="flex flex-wrap gap-2">
          {levels.map((l) => (
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

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/8 p-3">
          <p className="text-xs text-white/40 mb-2">原图</p>
          <div className="aspect-square rounded-lg bg-white/5 flex items-center justify-center text-white/25 text-xs">
            {fileName ? "模糊预览" : "—"}
          </div>
        </div>
        <div className="rounded-xl border border-white/8 p-3">
          <p className="text-xs text-white/40 mb-2">清晰化后</p>
          <div className="aspect-square rounded-lg bg-white/5 flex items-center justify-center text-white/25 text-xs">
            {preview ? "高清预览" : "—"}
          </div>
        </div>
      </div>

      <MockButton label="开始变清晰" successMessage="图片已增强，可下载高清版（演示）" />
      {fileName && (
        <button
          type="button"
          onClick={() => setPreview(true)}
          className="w-full text-xs text-white/35 hover:text-white/55 transition-colors"
        >
          模拟预览清晰效果 →
        </button>
      )}
    </div>
  );
}
