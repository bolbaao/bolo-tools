"use client";

import ActionButton from "@/components/ActionButton";
import { downloadBlob } from "@/lib/api";
import { previewUrlFromFile, sharpenImage } from "@/lib/image-processing";
import { useEffect, useState } from "react";

const levels = [
  { id: "light" as const, label: "轻度增强" },
  { id: "standard" as const, label: "标准清晰" },
  { id: "strong" as const, label: "强力修复" },
];

export default function ImageSharpenForm() {
  const [file, setFile] = useState<File | null>(null);
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);
  const [level, setLevel] = useState<"light" | "standard" | "strong">("standard");
  const [loading, setLoading] = useState(false);
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

  const handleSharpen = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const blob = await sharpenImage(file, level);
      if (afterUrl) URL.revokeObjectURL(afterUrl);
      const url = URL.createObjectURL(blob);
      setAfterUrl(url);
      const ext = file.name.split(".").pop() || "png";
      downloadBlob(blob, `${file.name.replace(/\.[^.]+$/, "")}-sharp.${ext}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "处理失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <label className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 cursor-pointer hover:border-sky-500/40 hover:bg-sky-500/5 transition-all">
        <span className="text-3xl opacity-60">◇</span>
        <span className="text-sm text-white/50">{file?.name ?? "上传需要增强的图片"}</span>
        <input type="file" accept="image/*" className="hidden" onChange={onFile} />
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
          <div className="aspect-square rounded-lg bg-white/5 overflow-hidden flex items-center justify-center">
            {beforeUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={beforeUrl} alt="原图" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-white/25 text-xs">—</span>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-white/8 p-3">
          <p className="text-xs text-white/40 mb-2">清晰化后</p>
          <div className="aspect-square rounded-lg bg-white/5 overflow-hidden flex items-center justify-center">
            {afterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={afterUrl} alt="处理后" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-white/25 text-xs">—</span>
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-400/90 text-center">{error}</p>}

      <ActionButton
        label="开始变清晰并下载"
        loading={loading}
        disabled={!file}
        onClick={handleSharpen}
      />
      <p className="text-center text-xs text-white/25">浏览器本地锐化处理，首次可能稍慢</p>
    </div>
  );
}
