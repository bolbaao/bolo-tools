"use client";

import ActionButton from "@/components/ActionButton";
import { ApiError, apiUpload, downloadBlob } from "@/lib/api";
import {
  detectEncryptedFormat,
  ENCRYPTED_ACCEPT,
  FORMAT_LABELS,
  unlockMusicFile,
} from "@/lib/music-unlock";
import { useCallback, useState } from "react";

const convertFormats = ["MP3", "WAV", "FLAC", "AAC", "OGG"];
const AUDIO_EXT = new Set(["mp3", "wav", "flac", "aac", "ogg", "m4a", "wma", "opus", "aiff", "aif"]);

type MusicKind = "encrypted" | "audio";

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

function classifyMusicFile(file: File): MusicKind | null {
  if (detectEncryptedFormat(file.name)) return "encrypted";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (AUDIO_EXT.has(ext) || file.type.startsWith("audio/")) return "audio";
  return null;
}

function extMatchesTarget(filename: string, targetFormat: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const target = targetFormat.toLowerCase();
  return ext === target || (ext === "mpeg" && target === "mp3");
}

function outputFilename(baseName: string, format: string): string {
  const base = baseName.replace(/\.[^.]+$/, "");
  return `${base}.${format.toLowerCase()}`;
}

async function convertWithFfmpeg(source: Blob, sourceName: string, format: string): Promise<Blob> {
  const fd = new FormData();
  fd.append("file", source, sourceName);
  fd.append("format", format);
  const blob = await apiUpload<Blob>("/api/audio/convert", fd);
  if (!(blob instanceof Blob)) throw new Error("转换失败");
  return blob;
}

export default function MusicConvertForm() {
  const [targetFormat, setTargetFormat] = useState("MP3");
  const [items, setItems] = useState<MusicItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const doneCount = items.filter((i) => i.status === "done").length;
  const errorCount = items.filter((i) => i.status === "error").length;

  const addFiles = useCallback((list: FileList | File[]) => {
    const accepted: MusicItem[] = [];
    const rejected: string[] = [];

    for (const file of Array.from(list)) {
      const kind = classifyMusicFile(file);
      if (kind) {
        accepted.push({ id: newId(), file, kind, status: "pending" });
      } else {
        rejected.push(file.name);
      }
    }

    if (accepted.length === 0) {
      setError(
        rejected.length
          ? `不支持的文件：${rejected.slice(0, 3).join("、")}${rejected.length > 3 ? "…" : ""}`
          : "请选择音频或加密音乐文件",
      );
      return;
    }

    const total = items.length + accepted.length;
    if (total > 50) {
      setError("单次建议不超过 50 个文件，以免内存或服务负载过高");
      return;
    }

    setError(null);
    setItems((prev) => [...prev, ...accepted]);
  }, [items.length]);

  const processFile = async (item: MusicItem): Promise<{ blob: Blob; filename: string }> => {
    if (item.kind === "encrypted") {
      const unlocked = await unlockMusicFile(item.file);
      let blob = unlocked.blob;
      let name = unlocked.filename;
      if (!extMatchesTarget(name, targetFormat)) {
        blob = await convertWithFfmpeg(blob, name, targetFormat);
        name = outputFilename(name, targetFormat);
      }
      return { blob, filename: name };
    }

    if (extMatchesTarget(item.file.name, targetFormat)) {
      return { blob: item.file, filename: item.file.name };
    }

    const blob = await convertWithFfmpeg(item.file, item.file.name, targetFormat);
    return { blob, filename: outputFilename(item.file.name, targetFormat) };
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
        const result = await processFile(item);
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: "done", result } : i)),
        );
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "处理失败";
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: "error", error: msg } : i)),
        );
      }
      current += 1;
      setProgress({ current, total: pending.length });
    }
    setLoading(false);
  };

  const downloadOne = (item: MusicItem) => {
    if (!item.result) return;
    downloadBlob(item.result.blob, item.result.filename);
  };

  const downloadAll = () => {
    items.filter((i) => i.status === "done" && i.result).forEach(downloadOne);
  };

  const downloadZip = async () => {
    const done = items.filter((i) => i.status === "done" && i.result);
    if (done.length === 0) return;
    setLoading(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const used = new Set<string>();
      for (const item of done) {
        const r = item.result!;
        let name = r.filename;
        let n = 1;
        while (used.has(name)) {
          const dot = r.filename.lastIndexOf(".");
          const base = dot > 0 ? r.filename.slice(0, dot) : r.filename;
          const ext = dot > 0 ? r.filename.slice(dot) : "";
          name = `${base} (${n})${ext}`;
          n += 1;
        }
        used.add(name);
        zip.file(name, r.blob);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, `音乐-${targetFormat}-${Date.now()}.zip`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "打包失败");
    } finally {
      setLoading(false);
    }
  };

  const clearAll = () => {
    setItems([]);
    setProgress({ current: 0, total: 0 });
    setError(null);
  };

  const accept = `${ENCRYPTED_ACCEPT},audio/*,.mp3,.wav,.flac,.aac,.ogg,.m4a`;

  return (
    <div className="space-y-6">
      <p className="text-center text-xs text-white/40 leading-relaxed">
        网易云 NCM、酷狗 KGM、酷我 KWM、虾米 XM 等在浏览器本地解密；普通音频由本机 ffmpeg 转码。
        统一输出为下方所选格式 · 批量建议少于 50 个。
      </p>

      <div className="flex flex-wrap justify-center gap-2">
        {Object.entries(FORMAT_LABELS).map(([key, label]) => (
          <span
            key={key}
            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-white/45"
          >
            {label}
          </span>
        ))}
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-white/35">
          + MP3/WAV/FLAC…
        </span>
      </div>

      <div>
        <label className="block text-sm text-white/60 mb-2">输出格式</label>
        <div className="flex flex-wrap gap-2">
          {convertFormats.map((f) => (
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

      <label
        className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 cursor-pointer hover:border-violet-500/40 hover:bg-violet-500/5 transition-all"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
      >
        <span className="text-3xl opacity-60">♪</span>
        <span className="text-sm text-white/50">选择或拖入音乐文件（可多选）</span>
        <span className="text-xs text-white/25 text-center px-4">
          .ncm · .kgm · .kwm · .xm · MP3 · WAV · FLAC · AAC · OGG 等
        </span>
        <input
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {items.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm text-white/50">
            {loading
              ? `正在处理 ${progress.current}/${progress.total}`
              : `已选 ${items.length} 个 · 成功 ${doneCount} · 失败 ${errorCount}`}
          </div>

          <ul className="max-h-56 overflow-y-auto rounded-xl border border-white/8 divide-y divide-white/5">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-white/75">
                    {item.file.name}
                    <span className="ml-2 text-xs text-white/30">
                      {item.kind === "encrypted" ? "解密" : "转码"}
                    </span>
                  </p>
                  {item.status === "error" && (
                    <p className="text-xs text-red-400/90 truncate">{item.error}</p>
                  )}
                  {item.status === "done" && item.result && (
                    <p className="text-xs text-emerald-400/80 truncate">→ {item.result.filename}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-white/35">
                  {item.status === "pending" && "等待"}
                  {item.status === "processing" && "处理中"}
                  {item.status === "done" && "完成"}
                  {item.status === "error" && "失败"}
                </span>
                {item.status === "done" && (
                  <button
                    type="button"
                    onClick={() => downloadOne(item)}
                    className="shrink-0 text-xs text-violet-300 hover:text-violet-200"
                  >
                    下载
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2">
            <ActionButton
              label={loading ? "处理中…" : `转换为 ${targetFormat}`}
              loading={loading}
              disabled={items.every((i) => i.status === "done")}
              onClick={runBatch}
            />
            {doneCount > 0 && (
              <>
                <button
                  type="button"
                  onClick={downloadAll}
                  className="rounded-xl border border-white/12 bg-white/5 px-4 py-2.5 text-sm text-white/60 hover:bg-white/10"
                >
                  下载全部
                </button>
                <button
                  type="button"
                  onClick={downloadZip}
                  disabled={loading}
                  className="rounded-xl border border-white/12 bg-white/5 px-4 py-2.5 text-sm text-white/60 hover:bg-white/10 disabled:opacity-40"
                >
                  打包 ZIP
                </button>
              </>
            )}
            <button
              type="button"
              onClick={clearAll}
              className="rounded-xl border border-white/12 bg-white/5 px-4 py-2.5 text-sm text-white/40 hover:bg-white/10"
            >
              清空列表
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-400/90 text-center">{error}</p>}

      <p className="text-center text-xs text-white/25">
        加密格式浏览器本地解密 · 格式互转需 ffmpeg · 酷狗需 kgm.mask · 不支持 QQ QMC
      </p>
    </div>
  );
}
