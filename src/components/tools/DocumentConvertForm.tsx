"use client";

import ActionButton from "@/components/ActionButton";
import { ApiError, apiGet, apiUploadBinary, assertFileSignature, downloadBlob } from "@/lib/api";
import {
  DOC_CONVERT_MODES,
  type DocCapabilities,
  type DocConvertMode,
} from "@/lib/doc-convert";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentConvertForm() {
  const [mode, setMode] = useState<DocConvertMode>("pdf-to-word");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caps, setCaps] = useState<DocCapabilities | null>(null);
  const [scale, setScale] = useState(2);
  const inputRef = useRef<HTMLInputElement>(null);

  const meta = useMemo(() => DOC_CONVERT_MODES.find((m) => m.id === mode)!, [mode]);

  useEffect(() => {
    apiGet<{ ok: boolean } & DocCapabilities>("/api/documents/capabilities")
      .then((data) => setCaps(data))
      .catch(() => setCaps(null));
  }, []);

  const modeAvailable = useMemo(() => {
    if (!caps) return true;
    const m = caps.modes[mode];
    if (!m) return true;
    return m.available !== false;
  }, [caps, mode]);

  const onModeChange = (next: DocConvertMode) => {
    setMode(next);
    setFiles([]);
    setError(null);
  };

  const onPickFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const picked = Array.from(list);
    setFiles(meta.multiple ? picked : [picked[0]]);
    setError(null);
  };

  const convert = useCallback(async () => {
    if (!files.length) {
      setError("请先选择文件");
      return;
    }
    if (!modeAvailable) {
      setError("请配置 CONVERTAPI_SECRET 或安装本地 LibreOffice（./scripts/download-libreoffice.sh）");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("mode", mode);
      if (mode === "pdf-to-images") {
        fd.append("scale", String(scale));
        fd.append("imageFormat", "png");
      }
      for (const f of files) fd.append("files", f);

      const { blob, filename: serverName } = await apiUploadBinary("/api/documents/convert", fd, {
        timeoutMs: 600000,
      });

      const bytes = new Uint8Array(await blob.arrayBuffer());
      const stem =
        files.length === 1
          ? files[0].name.replace(/\.[^.]+$/, "")
          : "merged";
      const ext =
        mode === "pdf-to-word"
          ? "docx"
          : mode === "word-to-pdf" || mode === "images-to-pdf"
            ? "pdf"
            : "zip";

      if (ext === "pdf") assertFileSignature(bytes, "pdf");
      else if (ext === "docx") assertFileSignature(bytes, "docx");
      else assertFileSignature(bytes, "zip");

      const mime =
        ext === "pdf"
          ? "application/pdf"
          : ext === "docx"
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : "application/zip";

      downloadBlob(new Blob([bytes], { type: mime }), serverName || `${stem}.${ext}`, mime);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "转换失败");
    } finally {
      setLoading(false);
    }
  }, [files, mode, modeAvailable, scale]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {DOC_CONVERT_MODES.map((m) => {
          const active = mode === m.id;
          const available = caps ? caps.modes[m.id]?.available !== false : true;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onModeChange(m.id)}
              className={`rounded-xl px-3 py-3 text-left text-sm transition-all ring-1 ${
                active
                  ? "bg-white/10 text-white ring-white/20"
                  : "bg-white/[0.03] text-white/50 ring-white/[0.08] hover:bg-white/[0.06] hover:text-white/70"
              } ${!available ? "opacity-60" : ""}`}
            >
              <span className="font-medium">{m.label}</span>
              {m.needsOffice && (
                <span className="mt-1 block text-[10px] text-cyan-200/70">本地/云端</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-sm text-white/45 leading-relaxed">{meta.hint}</p>

      {meta.needsOffice && caps?.libreOffice && (
        <p className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-3 text-xs leading-relaxed text-emerald-100/80">
          已检测到本地 LibreOffice。云端 ConvertAPI 在国内常无法直连时会<strong className="font-medium">自动改用本地转换</strong>，无需代理即可使用 PDF ↔ Word。
        </p>
      )}

      {meta.needsOffice && caps?.onlineConvert && !caps?.libreOffice && (
        <p className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-xs leading-relaxed text-cyan-100/85">
          若出现「无法连接云端」，请在 .env 配置 <code className="text-white/60">HTTPS_PROXY</code>，或运行{" "}
          <code className="text-white/50">./scripts/download-libreoffice.sh</code> 启用本地回退。
        </p>
      )}

      <div
        className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-5 py-8 text-center transition-colors hover:border-white/20 hover:bg-white/[0.03]"
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add("border-violet-400/30");
        }}
        onDragLeave={(e) => {
          e.currentTarget.classList.remove("border-violet-400/30");
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove("border-violet-400/30");
          onPickFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={meta.accept}
          multiple={meta.multiple}
          className="hidden"
          onChange={(e) => onPickFiles(e.target.files)}
        />
        <p className="text-sm text-white/55">
          {meta.multiple ? "拖入或选择多张图片" : "拖入或选择文件"}
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-4 rounded-full bg-white/[0.06] px-5 py-2 text-sm text-white/75 ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:text-white"
        >
          选择文件
        </button>
        <p className="mt-3 text-xs text-white/30">单文件最大 50MB</p>
      </div>

      {files.length > 0 && (
        <ul className="space-y-2 rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3">
          {files.map((f) => (
            <li key={`${f.name}-${f.size}`} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-white/70">{f.name}</span>
              <span className="shrink-0 text-xs text-white/35 tabular-nums">{formatBytes(f.size)}</span>
            </li>
          ))}
        </ul>
      )}

      {mode === "pdf-to-images" && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
          <div>
            <p className="text-sm text-white/70">导出清晰度</p>
            <p className="text-xs text-white/35 mt-0.5">数值越大图片越清晰，文件也更大</p>
          </div>
          <select
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40"
          >
            <option value={1}>标准</option>
            <option value={2}>高清</option>
            <option value={3}>超清</option>
          </select>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300/90">
          {error}
        </p>
      )}

      <ActionButton
        label="开始转换并下载"
        loadingLabel="转换中，请稍候…"
        onClick={convert}
        loading={loading}
        disabled={!files.length || !modeAvailable}
      />

      <p className="text-center text-xs text-white/25 leading-relaxed">
        PDF ↔ Word：优先云端，不可达时自动本地 LibreOffice · 图片类转换在本地完成
      </p>
    </div>
  );
}
