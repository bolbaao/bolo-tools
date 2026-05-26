"use client";

import ActionButton from "@/components/ActionButton";
import { downloadBlob } from "@/lib/api";
import {
  compressImage,
  formatBytes,
  outputFilename,
  previewUrlFromFile,
  type OutputFormat,
} from "@/lib/image-processing";
import { useEffect, useState } from "react";

const formats: OutputFormat[] = ["JPG", "PNG", "WebP"];

export default function ImageCompressForm() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [quality, setQuality] = useState("75");
  const [format, setFormat] = useState<OutputFormat>("WebP");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (preview) URL.revokeObjectURL(preview);
    setFile(f ?? null);
    setPreview(f ? previewUrlFromFile(f) : null);
    setResultSize(null);
    setError(null);
  };

  const handleCompress = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const blob = await compressImage(file, format, Number(quality));
      setResultSize(blob.size);
      downloadBlob(blob, outputFilename(file.name, format));
    } catch (e) {
      setError(e instanceof Error ? e.message : "压缩失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <label className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 cursor-pointer hover:border-lime-500/35 hover:bg-lime-500/5 transition-all">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="预览" className="max-h-40 rounded-lg object-contain" />
        ) : (
          <span className="text-3xl opacity-60">◐</span>
        )}
        <span className="text-sm text-white/50">{file?.name ?? "上传待压缩图片"}</span>
        <span className="text-xs text-white/25">浏览器本地处理，不上传服务器</span>
        <input type="file" accept="image/*" className="hidden" onChange={onFile} />
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
      </div>

      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 flex justify-between text-sm">
        <div>
          <p className="text-white/40 text-xs">原始大小</p>
          <p className="text-white/80 mt-1">{file ? formatBytes(file.size) : "—"}</p>
        </div>
        <div className="text-white/20">→</div>
        <div className="text-right">
          <p className="text-white/40 text-xs">压缩后</p>
          <p className="text-lime-300 mt-1">
            {resultSize != null ? formatBytes(resultSize) : "点击压缩后显示"}
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-red-400/90 text-center">{error}</p>}

      <ActionButton
        label={`压缩并下载 ${format}`}
        loading={loading}
        disabled={!file}
        onClick={handleCompress}
      />
    </div>
  );
}
