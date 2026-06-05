"use client";

import ActionButton from "@/components/ActionButton";
import { downloadBlob } from "@/lib/api";
import { formatBytes } from "@/lib/format";
import {
  buildMusicZip,
  classifyMusicFile,
  FORMAT_HINTS,
  OUTPUT_FORMATS,
  processMusicFile,
  toProcessError,
  type MusicKind,
  type OutputFormat,
} from "@/lib/music-convert";
import { ENCRYPTED_ACCEPT } from "@/lib/music-unlock";
import { useAgentPrefill } from "@/hooks/useAgentPrefill";
import { useCallback, useMemo, useRef, useState } from "react";

const PLATFORMS = [
  { label: "网易云", tone: "from-rose-500/20 to-pink-500/5 text-rose-200/90 ring-rose-500/25" },
  { label: "QQ音乐", tone: "from-green-500/20 to-lime-500/5 text-green-200/90 ring-green-500/25" },
  { label: "酷狗", tone: "from-amber-500/20 to-orange-500/5 text-amber-200/90 ring-amber-500/25" },
  { label: "酷我", tone: "from-sky-500/20 to-cyan-500/5 text-sky-200/90 ring-sky-500/25" },
  { label: "虾米", tone: "from-emerald-500/20 to-teal-500/5 text-emerald-200/90 ring-emerald-500/25" },
] as const;

type MusicItem = {
  id: string;
  file: File;
  kind: MusicKind;
  status: "pending" | "processing" | "done" | "error";
  result?: { blob: Blob; filename: string };
  error?: string;
};

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function WaveformDecor({ active }: { active?: boolean }) {
  return (
    <div
      className={`flex items-end justify-center gap-1 h-10 ${active ? "opacity-100" : "opacity-40"}`}
      aria-hidden
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`w-1 rounded-full bg-gradient-to-t from-violet-500/80 to-fuchsia-400/60 ${
            active ? "animate-[music-bar_1.1s_ease-in-out_infinite]" : "h-3"
          }`}
          style={active ? { animationDelay: `${i * 0.12}s`, height: `${12 + (i % 3) * 8}px` } : undefined}
        />
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: MusicItem["status"] }) {
  const map = {
    pending: { label: "等待", className: "bg-white/5 text-white/40 ring-white/10" },
    processing: { label: "处理中", className: "bg-violet-500/15 text-violet-200 ring-violet-500/30" },
    done: { label: "完成", className: "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30" },
    error: { label: "失败", className: "bg-red-500/15 text-red-300 ring-red-500/30" },
  };
  const s = map[status];
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${s.className}`}>
      {status === "processing" ? (
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 animate-spin rounded-full border border-violet-300/40 border-t-violet-200" />
          {s.label}
        </span>
      ) : (
        s.label
      )}
    </span>
  );
}

export default function MusicConvertForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [targetFormat, setTargetFormat] = useState<OutputFormat>("MP3");
  const [items, setItems] = useState<MusicItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useAgentPrefill("music-convert", {
    apply: (fields) => {
      const fmt = fields.format?.toUpperCase();
      if (fmt && OUTPUT_FORMATS.includes(fmt as OutputFormat)) {
        setTargetFormat(fmt as OutputFormat);
      }
    },
  });

  const stats = useMemo(() => {
    const total = items.length;
    const done = items.filter((i) => i.status === "done").length;
    const failed = items.filter((i) => i.status === "error").length;
    const pending = items.filter((i) => i.status === "pending" || i.status === "error").length;
    const totalBytes = items.reduce((s, i) => s + i.file.size, 0);
    return { total, done, failed, pending, totalBytes };
  }, [items]);

  const progressPct = useMemo(() => {
    if (loading && progress.total > 0) {
      return Math.round((progress.current / progress.total) * 100);
    }
    if (stats.total > 0 && stats.done > 0) {
      return Math.round((stats.done / stats.total) * 100);
    }
    return 0;
  }, [loading, progress, stats]);

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const accepted: MusicItem[] = [];
      const rejected: string[] = [];

      for (const file of Array.from(list)) {
        const kind = classifyMusicFile(file);
        if (kind) accepted.push({ id: newId(), file, kind, status: "pending" });
        else rejected.push(file.name);
      }

      if (accepted.length === 0) {
        setError(
          rejected.length
            ? `无法识别：${rejected.slice(0, 2).join("、")}${rejected.length > 2 ? " 等" : ""}`
            : "请添加加密音乐或普通音频文件",
        );
        return;
      }

      if (items.length + accepted.length > 50) {
        setError("单次最多 50 个文件，请分批处理");
        return;
      }

      setError(null);
      setItems((prev) => [...prev, ...accepted]);
    },
    [items.length],
  );

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const runBatch = async () => {
    const pending = items.filter((i) => i.status === "pending" || i.status === "error");
    if (pending.length === 0) return;

    setLoading(true);
    setError(null);
    setProgress({ current: 0, total: pending.length });

    let current = 0;
    for (const item of pending) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: "processing", error: undefined } : i)),
      );
      try {
        const result = await processMusicFile(item.file, item.kind, targetFormat);
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: "done", result } : i)),
        );
      } catch (e) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: "error", error: toProcessError(e) } : i,
          ),
        );
      }
      current += 1;
      setProgress({ current, total: pending.length });
    }
    setLoading(false);
  };

  const downloadZip = async () => {
    const done = items.filter((i) => i.status === "done" && i.result);
    if (done.length === 0) return;
    setLoading(true);
    try {
      const blob = await buildMusicZip(done.map((i) => i.result!));
      downloadBlob(blob, `music-${targetFormat}-${Date.now()}.zip`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "打包失败");
    } finally {
      setLoading(false);
    }
  };

  const accept = `${ENCRYPTED_ACCEPT},audio/*,.mp3,.wav,.flac,.aac,.ogg,.m4a`;
  const canProcess = stats.pending > 0 && !loading;
  const hasDone = stats.done > 0;

  return (
    <div className="space-y-8">
      {/* 能力概览 */}
      <section className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-violet-300/70">
              音乐工坊
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-white/95">
              解锁 · 转码 · 一站完成
            </h2>
            <p className="mt-2 text-sm text-white/40 leading-relaxed max-w-md font-light">
              把各平台下载的音乐转成 MP3、FLAC 等常用格式，可一次选很多首，完成后单首下载或打包带走。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {PLATFORMS.map((p) => (
              <span
                key={p.label}
                className={`inline-flex items-center rounded-full bg-gradient-to-r px-3 py-1 text-[11px] font-medium ring-1 ${p.tone}`}
              >
                {p.label}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3 text-[11px] text-white/35">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-emerald-400/80" />
            安全处理，注重隐私
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-violet-400/80" />
            批量：建议 ≤50 首
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-green-400/80" />
            支持 QQ 音乐 QMC / mflac / mgg
          </span>
        </div>
      </section>

      {/* 输出格式 */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <label className="text-sm font-medium text-white/70">输出格式</label>
          <span className="text-xs text-white/30">{FORMAT_HINTS[targetFormat]}</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {OUTPUT_FORMATS.map((f) => {
            const active = targetFormat === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setTargetFormat(f)}
                className={`relative rounded-xl px-3 py-3 text-center transition-all duration-300 ${
                  active
                    ? "bg-gradient-to-b from-violet-500/25 to-fuchsia-500/10 text-violet-100 ring-1 ring-violet-400/40 shadow-[0_0_24px_-6px_rgba(139,92,246,0.45)]"
                    : "bg-white/[0.03] text-white/45 ring-1 ring-white/[0.06] hover:bg-white/[0.06] hover:text-white/65"
                }`}
              >
                <span className="block text-sm font-semibold tracking-wide">{f}</span>
                <span className="mt-0.5 block text-[10px] opacity-60 font-light">{FORMAT_HINTS[f]}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 上传区 */}
      <section
        className={`relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 ${
          dragActive
            ? "border-violet-400/50 bg-violet-500/[0.08] scale-[1.01]"
            : "border-white/12 bg-white/[0.02] hover:border-violet-500/30 hover:bg-violet-500/[0.04]"
        }`}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragActive(false);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(139,92,246,0.12),transparent_55%)]"
          aria-hidden
        />
        <label className="relative flex flex-col items-center justify-center gap-4 px-6 py-12 sm:py-14 cursor-pointer">
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/25 to-fuchsia-500/15 ring-1 ring-white/10 transition-transform duration-300 ${
              dragActive ? "scale-110" : ""
            }`}
          >
            <WaveformDecor active={dragActive || loading} />
          </div>
          <div className="text-center">
            <p className="text-base font-medium text-white/80">
              {dragActive ? "松开即可添加" : "拖入音乐文件，或点击选择"}
            </p>
            <p className="mt-1.5 text-xs text-white/35 max-w-sm">
              支持网易云、QQ 音乐、酷狗、酷我、虾米及 MP3、WAV、FLAC 等常见格式
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              inputRef.current?.click();
            }}
            className="pointer-events-auto rounded-full bg-white/10 px-5 py-2 text-xs font-medium text-white/70 ring-1 ring-white/15 hover:bg-white/15 hover:text-white transition-colors"
          >
            浏览文件
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </section>

      {/* 队列 */}
      {items.length > 0 && (
        <section className="space-y-4 animate-[bento-in_0.4s_ease-out]">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
              <div className="grid grid-cols-3 gap-4 sm:gap-8">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/30">队列</p>
                  <p className="mt-0.5 text-2xl font-semibold tabular-nums text-white/90">{stats.total}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-emerald-400/60">完成</p>
                  <p className="mt-0.5 text-2xl font-semibold tabular-nums text-emerald-300/90">
                    {stats.done}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-red-400/50">失败</p>
                  <p className="mt-0.5 text-2xl font-semibold tabular-nums text-white/50">
                    {stats.failed}
                  </p>
                </div>
              </div>
              <p className="text-xs text-white/30">共 {formatBytes(stats.totalBytes)}</p>
            </div>

            <div className="h-1 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-white/30 text-right tabular-nums">
              {loading
                ? `处理中 ${progress.current} / ${progress.total}`
                : stats.done === stats.total
                  ? "全部完成"
                  : `${progressPct}%`}
            </p>
          </div>

          <ul className="space-y-2 max-h-[min(320px,50vh)] overflow-y-auto pr-1 custom-scrollbar">
            {items.map((item, index) => (
              <li
                key={item.id}
                className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-colors hover:border-white/10 hover:bg-white/[0.04]"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    item.kind === "encrypted"
                      ? "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/25"
                      : "bg-fuchsia-500/10 text-fuchsia-300/90 ring-1 ring-fuchsia-500/20"
                  }`}
                >
                  {item.kind === "encrypted" ? "锁" : "♪"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white/85">{item.file.name}</p>
                  <p className="text-[11px] text-white/35 mt-0.5">
                    {formatBytes(item.file.size)}
                    {item.kind === "encrypted" && item.status === "done" ? " · 已解锁" : ""}
                    {item.status === "done" && item.result && (
                      <span className="text-emerald-400/70"> → {item.result.filename}</span>
                    )}
                  </p>
                  {item.status === "error" && item.error && (
                    <p className="text-[11px] text-red-400/85 mt-1 line-clamp-2">{item.error}</p>
                  )}
                </div>
                <StatusBadge status={item.status} />
                {item.status === "done" && item.result && (
                  <button
                    type="button"
                    onClick={() => downloadBlob(item.result!.blob, item.result!.filename)}
                    className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-violet-300 bg-violet-500/10 ring-1 ring-violet-500/25 hover:bg-violet-500/20 transition-colors"
                  >
                    下载
                  </button>
                )}
                {item.status !== "processing" && (
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 p-1.5 text-white/25 hover:text-white/50 transition-all"
                    aria-label="移除"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="flex flex-col sm:flex-row gap-2">
            <ActionButton
              className="sm:flex-1"
              label={
                loading
                  ? "正在处理…"
                  : stats.failed > 0 && stats.pending === stats.failed
                    ? `重试失败项 · ${targetFormat}`
                    : `开始转换 · ${targetFormat}`
              }
              loading={loading}
              loadingLabel={`处理中 ${progress.current}/${progress.total || "—"}`}
              disabled={!canProcess}
              onClick={runBatch}
            />
            {hasDone && (
              <div className="flex gap-2 sm:shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    items
                      .filter((i) => i.status === "done" && i.result)
                      .forEach((i) => downloadBlob(i.result!.blob, i.result!.filename))
                  }
                  className="flex-1 sm:flex-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors"
                >
                  全部下载
                </button>
                <button
                  type="button"
                  onClick={downloadZip}
                  disabled={loading}
                  className="flex-1 sm:flex-none rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 py-3 text-sm text-violet-200 hover:bg-violet-500/20 transition-colors disabled:opacity-40"
                >
                  ZIP
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setItems([]);
              setProgress({ current: 0, total: 0 });
              setError(null);
            }}
            className="w-full text-center text-xs text-white/25 hover:text-white/45 transition-colors py-1"
          >
            清空队列
          </button>
        </section>
      )}

      {items.length === 0 && !loading && (
        <p className="text-center text-xs text-white/25 -mt-2">
          选择输出格式后，添加文件并点击「开始转换」
        </p>
      )}

      {error && (
        <div
          className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200/90 text-center leading-relaxed"
          role="alert"
        >
          {error}
        </div>
      )}
    </div>
  );
}
