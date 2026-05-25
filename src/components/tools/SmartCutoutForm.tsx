"use client";

import MockButton from "@/components/MockButton";
import { useState } from "react";

export default function SmartCutoutForm() {
  const [preview, setPreview] = useState(false);
  const [hasImage, setHasImage] = useState(false);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHasImage(!!e.target.files?.[0]);
    setPreview(false);
  };

  return (
    <div className="space-y-6">
      <label className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-8 cursor-pointer hover:border-emerald-500/35 hover:bg-emerald-500/5 transition-all">
        <span className="text-3xl opacity-60">◈</span>
        <span className="text-sm text-white/50">
          {hasImage ? "图片已选择，可重新上传" : "上传需要抠图的图片"}
        </span>
        <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/8 p-3">
          <p className="text-xs text-white/40 mb-2">原图</p>
          <div className="aspect-square rounded-lg bg-white/5 flex items-center justify-center text-white/20 text-xs">
            {hasImage ? "原图预览" : "—"}
          </div>
        </div>
        <div
          className="rounded-xl border border-white/8 p-3"
          style={{
            backgroundImage: preview
              ? "linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)"
              : undefined,
            backgroundSize: preview ? "12px 12px" : undefined,
            backgroundPosition: preview ? "0 0, 0 6px, 6px -6px, -6px 0" : undefined,
          }}
        >
          <p className="text-xs text-white/40 mb-2">抠图结果</p>
          <div className="aspect-square rounded-lg bg-white/5 flex items-center justify-center text-white/20 text-xs">
            {preview ? "透明背景 PNG" : "—"}
          </div>
        </div>
      </div>

      <MockButton
        label="开始智能抠图"
        successMessage="抠图完成，可下载 PNG（演示）"
      />
      {hasImage && (
        <button
          type="button"
          onClick={() => setPreview(true)}
          className="w-full text-xs text-white/35 hover:text-white/55 transition-colors"
        >
          模拟显示抠图结果 →
        </button>
      )}
    </div>
  );
}
