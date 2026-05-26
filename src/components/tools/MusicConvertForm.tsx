"use client";

import ActionButton from "@/components/ActionButton";
import { ApiError, apiUpload, downloadBlob } from "@/lib/api";
import {
  ENCRYPTED_ACCEPT,
  FORMAT_LABELS,
  isEncryptedMusicFile,
  unlockMusicFile,
  type UnlockResult,
} from "@/lib/music-unlock";
import { useCallback, useState } from "react";

const convertFormats = ["MP3", "WAV", "FLAC", "AAC", "OGG"];

type Mode = "unlock" | "convert";

type UnlockItem = {
  id: string;
  file: File;
  status: "pending" | "processing" | "done" | "error";
  result?: UnlockResult;
  error?: string;
};

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function MusicConvertForm() {
  const [mode, setMode] = useState<Mode>("unlock");
  const [targetFormat, setTargetFormat] = useState("MP3");
  const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<UnlockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const doneCount = items.filter((i) => i.status === "done").length;
  const errorCount = items.filter((i) => i.status === "error").length;

  const addFiles = useCallback((list: FileList | File[]) => {
    const files = Array.from(list).filter(isEncryptedMusicFile);
    if (files.length === 0) {
      setError("请选择 .ncm / .kgm / .kwm / .xm 等加密音乐文件");
      return;
    }
    if (files.length > 50) {
      setError("单次建议不超过 50 个文件，以免浏览器内存不足");
      return;
    }
    setError(null);
    setItems((prev) => [
      ...prev,
      ...files.map((f) => ({ id: newId(), file: f, status: "pending" as const })),
    ]);
  }, []);

  const runUnlockBatch = async () => {
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
        const result = await unlockMusicFile(item.file);
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: "done", result } : i)),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "解密失败";
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: "error", error: msg } : i)),
        );
      }
      current += 1;
      setProgress({ current, total: pending.length });
    }
    setLoading(false);
  };

  const downloadOne = (item: UnlockItem) => {
    if (!item.result) return;
    downloadBlob(item.result.blob, item.result.filename);
  };

  const downloadAll = () => {
    items.filter((i) => i.status === "done" && i.result).forEach((i) => downloadOne(i));
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
      downloadBlob(blob, `解锁音乐-${Date.now()}.zip`);
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

  const handleConvert = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("format", targetFormat);
      const blob = await apiUpload<Blob>("/api/audio/convert", fd);
      if (!(blob instanceof Blob)) throw new Error("转换失败");
      const ext = targetFormat.toLowerCase();
      const base = file.name.replace(/\.[^.]+$/, "");
      downloadBlob(blob, `${base}.${ext}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "转换失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
        <button
          type="button"
          onClick={() => {
            setMode("unlock");
            setError(null);
          }}
          className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
            mode === "unlock"
              ? "bg-violet-600/35 text-violet-100 border border-violet-500/30"
              : "text-white/45 hover:text-white/70"
          }`}
        >
          云音乐解锁
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("convert");
            setError(null);
          }}
          className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
            mode === "convert"
              ? "bg-violet-600/35 text-violet-100 border border-violet-500/30"
              : "text-white/45 hover:text-white/70"
          }`}
        >
          音频格式转换
        </button>
      </div>

      {mode === "unlock" ? (
        <>
          <p className="text-center text-xs text-white/40 leading-relaxed">
            参考{" "}
            <a
              href="https://ncm.worthsee.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-300/80 hover:text-violet-200 underline underline-offset-2"
            >
              NCM 在线转换
            </a>
            ：在浏览器本地解密，文件不上传服务器。支持网易云 NCM、酷狗 KGM/VPR、酷我 KWM、虾米 XM。
            批量建议少于 50 个；转换占用约为文件总大小的数倍内存。
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
            <span className="text-sm text-white/50">选择或拖入加密音乐（可多选）</span>
            <span className="text-xs text-white/25">.ncm · .kgm · .vpr · .kwm · .xm</span>
            <input
              type="file"
              accept={ENCRYPTED_ACCEPT}
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
              <div className="flex items-center justify-between text-sm text-white/50">
                <span>
                  {loading
                    ? `正在转换 ${progress.current}/${progress.total}`
                    : `已选 ${items.length} 个 · 成功 ${doneCount} · 失败 ${errorCount}`}
                </span>
              </div>

              <ul className="max-h-56 overflow-y-auto rounded-xl border border-white/8 divide-y divide-white/5">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-white/75">{item.file.name}</p>
                      {item.status === "error" && (
                        <p className="text-xs text-red-400/90 truncate">{item.error}</p>
                      )}
                      {item.status === "done" && item.result && (
                        <p className="text-xs text-emerald-400/80 truncate">
                          → {item.result.filename}
                        </p>
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
                  label={loading ? "转换中…" : "开始转换"}
                  loading={loading}
                  disabled={items.every((i) => i.status === "done")}
                  onClick={runUnlockBatch}
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

          <p className="text-center text-xs text-white/25">
            解密算法参考 Unlock Music 开源项目 · 仅供个人学习 · 不支持 QQ 音乐 QMC
          </p>
        </>
      ) : (
        <>
          <label className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 cursor-pointer hover:border-violet-500/40 hover:bg-violet-500/5 transition-all">
            <span className="text-3xl opacity-60">♪</span>
            <span className="text-sm text-white/50">{file?.name ?? "点击上传普通音频"}</span>
            <span className="text-xs text-white/25">MP3 / WAV / FLAC / AAC / OGG 等</span>
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setError(null);
              }}
            />
          </label>

          <div>
            <label className="block text-sm text-white/60 mb-2">目标格式</label>
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

          <ActionButton
            label={`转换为 ${targetFormat} 并下载`}
            loading={loading}
            disabled={!file}
            onClick={handleConvert}
          />
          <p className="text-center text-xs text-white/25">
            服务端 ffmpeg 转换 · 需本机安装 ffmpeg · 单文件最大 50MB
          </p>
        </>
      )}

      {error && <p className="text-sm text-red-400/90 text-center">{error}</p>}
    </div>
  );
}
