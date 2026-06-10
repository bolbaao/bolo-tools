"use client";

import ActionButton from "@/components/ActionButton";
import { ApiError, apiGet, apiUploadBinary, assertFileSignature, downloadBlob } from "@/lib/api";
import {
  DOC_CONVERT_MODES,
  type DocCapabilities,
  type DocConvertMode,
} from "@/lib/doc-convert";
import { inferDocConvertModeFromFiles } from "@/lib/doc-convert-prefill";
import { FEATURE_UNAVAILABLE } from "@/lib/service-message";
import { AGENT_AUTOSUBMIT_DELAY_MS } from "@/lib/agent-prefill";
import { formatBytes } from "@/lib/format";
import { useAgentPrefill } from "@/hooks/useAgentPrefill";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export default function DocumentConvertForm() {
  const [mode, setMode] = useState<DocConvertMode>("pdf-to-word");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caps, setCaps] = useState<DocCapabilities | null>(null);
  const [scale, setScale] = useState(2);
  const inputRef = useRef<HTMLInputElement>(null);

  const meta = useMemo(() => DOC_CONVERT_MODES.find((m) => m.id === mode)!, [mode]);

  const autoConvertAfterPrefillRef = useRef(false);

  const onModeChange = useCallback((next: DocConvertMode) => {
    setMode(next);
    setFiles([]);
    setError(null);
  }, []);

  const applyPickedFiles = useCallback((picked: File[]) => {
    if (!picked.length) return;
    const inferred = inferDocConvertModeFromFiles(picked);
    const targetMode = inferred ?? mode;
    const targetMeta = DOC_CONVERT_MODES.find((m) => m.id === targetMode)!;
    setFiles(targetMeta.multiple ? picked : [picked[0]]);
    setError(null);
    if (inferred) setMode(inferred);
  }, [mode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    autoConvertAfterPrefillRef.current =
      params.get("agent_tool") === "doc-convert" && params.get("agent_auto") === "1";
  }, []);

  useAgentPrefill("doc-convert", {
    apply: (fields) => {
      const next = fields.mode as DocConvertMode;
      if (DOC_CONVERT_MODES.some((m) => m.id === next)) setMode(next);
    },
  });

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

  const onPickFiles = (list: FileList | null) => {
    if (!list?.length) return;
    applyPickedFiles(Array.from(list));
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const moveFile = (index: number, dir: -1 | 1) => {
    setFiles((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const convert = useCallback(async () => {
    if (!files.length) {
      setError("请先选择文件");
      return;
    }
    if (!modeAvailable) {
      setError(FEATURE_UNAVAILABLE);
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
          : mode === "word-to-pdf" ||
              mode === "images-to-pdf" ||
              mode === "pdf-merge" ||
              mode === "pdf-compress"
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

  useEffect(() => {
    if (!files.length || !autoConvertAfterPrefillRef.current) return;
    autoConvertAfterPrefillRef.current = false;
    const timer = window.setTimeout(() => {
      void convert();
    }, AGENT_AUTOSUBMIT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [files.length, convert]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
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
            </button>
          );
        })}
      </div>

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
          {meta.multiple
            ? mode === "pdf-merge"
              ? "拖入或选择多个 PDF（按列表顺序合并）"
              : "拖入或选择多个文件"
            : "拖入或选择文件"}
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
          {files.map((f, i) => (
            <li key={`${f.name}-${f.size}-${i}`} className="flex items-center justify-between gap-2 text-sm">
              {meta.multiple && files.length > 1 && (
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => moveFile(i, -1)}
                    className="text-[10px] text-white/30 hover:text-white/60 disabled:opacity-20"
                    aria-label="上移"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    disabled={i === files.length - 1}
                    onClick={() => moveFile(i, 1)}
                    className="text-[10px] text-white/30 hover:text-white/60 disabled:opacity-20"
                    aria-label="下移"
                  >
                    ▼
                  </button>
                </div>
              )}
              <span className="truncate text-white/70 flex-1">{f.name}</span>
              <span className="shrink-0 text-xs text-white/35 tabular-nums">{formatBytes(f.size)}</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="shrink-0 text-white/30 hover:text-red-300/80 text-xs px-1"
                aria-label="移除"
              >
                ✕
              </button>
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

    </div>
  );
}
