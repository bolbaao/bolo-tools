"use client";

import ActionButton from "@/components/ActionButton";
import { downloadBlob } from "@/lib/api";
import { previewUrlFromFile } from "@/lib/image-processing";
import { useEffect, useState } from "react";

export default function SmartCutoutForm() {
  const [file, setFile] = useState<File | null>(null);
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (beforeUrl) URL.revokeObjectURL(beforeUrl);
      if (afterUrl) URL.revokeObjectURL(afterUrl);
    };
  }, [beforeUrl, afterUrl]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (beforeUrl) URL.revokeObjectURL(beforeUrl);
    if (afterUrl) URL.revokeObjectURL(afterUrl);
    setFile(f ?? null);
    setBeforeUrl(f ? previewUrlFromFile(f) : null);
    setAfterUrl(null);
    setError(null);
  };

  const handleCutout = async () => {
    if (!file || !beforeUrl) return;
    setLoading(true);
    setLoadProgress("正在加载 AI 模型（首次较慢）…");
    setError(null);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      setLoadProgress("正在抠图…");
      const blob = await removeBackground(beforeUrl, {
        progress: (key, current, total) => {
          if (total) {
            setLoadProgress(`${key} ${Math.round((current / total) * 100)}%`);
          }
        },
      });
      if (afterUrl) URL.revokeObjectURL(afterUrl);
      const url = URL.createObjectURL(blob);
      setAfterUrl(url);
      const name = `${file.name.replace(/\.[^.]+$/, "")}-cutout.png`;
      downloadBlob(blob, name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "抠图失败");
    } finally {
      setLoading(false);
      setLoadProgress("");
    }
  };

  return (
    <div className="space-y-6">
      <label className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-8 cursor-pointer hover:border-emerald-500/35 hover:bg-emerald-500/5 transition-all">
        <span className="text-3xl opacity-60">◈</span>
        <span className="text-sm text-white/50">
          {file ? file.name : "上传需要抠图的图片"}
        </span>
        <span className="text-xs text-white/25">浏览器本地 AI 抠图，不上传服务器</span>
        <input type="file" accept="image/*" className="hidden" onChange={onFile} />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/8 p-3">
          <p className="text-xs text-white/40 mb-2">原图</p>
          <div className="aspect-square rounded-lg bg-white/5 overflow-hidden flex items-center justify-center">
            {beforeUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={beforeUrl} alt="原图" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-white/25 text-xs">—</span>
            )}
          </div>
        </div>
        <div
          className="rounded-xl border border-white/8 p-3"
          style={{
            backgroundImage: afterUrl
              ? "linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)"
              : undefined,
            backgroundSize: afterUrl ? "12px 12px" : undefined,
            backgroundPosition: afterUrl ? "0 0, 0 6px, 6px -6px, -6px 0" : undefined,
          }}
        >
          <p className="text-xs text-white/40 mb-2">抠图结果</p>
          <div className="aspect-square rounded-lg overflow-hidden flex items-center justify-center">
            {afterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={afterUrl} alt="抠图" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-white/25 text-xs bg-white/5 w-full h-full flex items-center justify-center rounded-lg">
                —
              </span>
            )}
          </div>
        </div>
      </div>

      {loadProgress && (
        <p className="text-center text-xs text-violet-300/80 animate-pulse">{loadProgress}</p>
      )}
      {error && <p className="text-sm text-red-400/90 text-center">{error}</p>}

      <ActionButton
        label="开始智能抠图"
        loading={loading}
        loadingLabel={loadProgress || "处理中…"}
        disabled={!file}
        onClick={handleCutout}
      />
    </div>
  );
}
