"use client";

import ActionButton from "@/components/ActionButton";
import { ApiError, apiGet, apiUpload, downloadText } from "@/lib/api";
import { shiftSrt, srtToVtt } from "@/lib/srt";
import { useAgentPrefill } from "@/hooks/useAgentPrefill";
import { useCallback, useEffect, useState } from "react";

type Tab = "transcribe" | "extract" | "edit";
type SubFormat = "srt" | "vtt" | "text";

type TranscribeMode = "local" | "api";

type TranscribeStatus = {
  available: boolean;
  localAvailable?: boolean;
  apiAvailable?: boolean;
  defaultMode?: TranscribeMode | null;
  mode?: string | null;
  apiModel?: string | null;
  hint?: string | null;
};

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "transcribe", label: "语音转文字", hint: "音视频转字幕" },
  { id: "extract", label: "提取内嵌", hint: "从视频取字幕轨" },
  { id: "edit", label: "编辑导出", hint: "平移 / 转 VTT" },
];

export default function SubtitleWorkshopForm() {
  const [tab, setTab] = useState<Tab>("transcribe");
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<SubFormat>("srt");
  const [srtText, setSrtText] = useState("");
  const [shiftSec, setShiftSec] = useState("0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [transcribeStatus, setTranscribeStatus] = useState<TranscribeStatus | null>(null);
  const [transcribeMode, setTranscribeMode] = useState<TranscribeMode>("local");

  useAgentPrefill("subtitle-workshop", {
    apply: (fields) => {
      const next = fields.tab as Tab;
      if (TABS.some((t) => t.id === next)) setTab(next);
    },
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiGet<TranscribeStatus & { ok?: boolean }>("/api/subtitle/status");
        if (!cancelled) {
          const status: TranscribeStatus = {
            available: data.available,
            localAvailable: data.localAvailable,
            apiAvailable: data.apiAvailable,
            defaultMode: (data.defaultMode ?? data.mode) as TranscribeMode | null,
            mode: data.mode,
            apiModel: data.apiModel,
            hint: data.hint,
          };
          setTranscribeStatus(status);
          const preferred =
            status.defaultMode ??
            (status.apiAvailable ? "api" : status.localAvailable ? "local" : "local");
          setTranscribeMode(preferred);
        }
      } catch {
        if (!cancelled) {
          setTranscribeStatus({
            available: false,
            hint: "语音转写服务暂不可用，请稍后再试或联系客服。",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedModeAvailable =
    transcribeMode === "api"
      ? Boolean(transcribeStatus?.apiAvailable)
      : Boolean(transcribeStatus?.localAvailable);

  const downloadContent = (content: string, filename: string) => {
    downloadText(content, filename);
  };

  const handleTranscribe = async () => {
    if (!file) return;
    if (transcribeStatus && !transcribeStatus.available) {
      setError(transcribeStatus.hint || "语音转写暂不可用，请先安装依赖并重启服务");
      return;
    }
    if (transcribeStatus && !selectedModeAvailable) {
      setError(
        transcribeMode === "api"
          ? "云端转写未配置。请在服务器 .env 填入 ARK_API_KEY 后重启。"
          : "本地转写未就绪。请安装 faster-whisper 或改用云端转写。",
      );
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("format", format);
      fd.append("mode", transcribeMode);
      const data = await apiUpload<{
        ok: boolean;
        content: string;
        filename: string;
        message?: string;
      }>("/api/subtitle/transcribe", fd, { timeoutMs: 300000 });
      if (data instanceof Blob) throw new Error("返回格式错误");
      setSrtText(data.content);
      setMessage(data.message || "转写完成");
      if (tab !== "edit") setTab("edit");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "转写失败");
    } finally {
      setLoading(false);
    }
  };

  const handleExtract = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const data = await apiUpload<{
        ok: boolean;
        content: string;
        filename: string;
      }>("/api/subtitle/extract", fd, { timeoutMs: 120000 });
      if (data instanceof Blob) throw new Error("返回格式错误");
      setSrtText(data.content);
      setMessage("已提取内嵌字幕");
      setTab("edit");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "提取失败");
    } finally {
      setLoading(false);
    }
  };

  const handleShift = () => {
    const offset = Number(shiftSec) || 0;
    setSrtText(shiftSrt(srtText, offset));
    setMessage(`已平移 ${offset} 秒`);
  };

  const handleExport = (outFormat: "srt" | "vtt") => {
    if (!srtText.trim()) return;
    const content = outFormat === "vtt" ? srtToVtt(srtText) : srtText;
    downloadContent(content, `subtitle.${outFormat}`);
  };

  const primaryAction = () => {
    if (tab === "transcribe") return handleTranscribe();
    if (tab === "extract") return handleExtract();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/8">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setError(null);
            }}
            className={`flex-1 min-w-[5rem] rounded-lg px-2 py-2.5 text-center transition-all ${
              tab === t.id
                ? "bg-cyan-600/25 text-cyan-100 border border-cyan-500/30"
                : "text-white/45 hover:bg-white/5"
            }`}
          >
            <span className="block text-sm font-medium">{t.label}</span>
            <span className="block text-[10px] opacity-60 mt-0.5">{t.hint}</span>
          </button>
        ))}
      </div>

      {tab === "transcribe" && transcribeStatus && !transcribeStatus.available && (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90 leading-relaxed">
          {transcribeStatus.hint || "语音转写暂不可用"}
        </p>
      )}

      {tab === "transcribe" && transcribeStatus?.hint && transcribeStatus.available && (
        <p className="text-xs text-center text-white/35 leading-relaxed">{transcribeStatus.hint}</p>
      )}

      {tab === "transcribe" &&
        transcribeStatus?.available &&
        (transcribeStatus.localAvailable || transcribeStatus.apiAvailable) && (
          <div>
            <label className="block text-sm text-white/60 mb-2">转写方式</label>
            <div className="flex flex-wrap gap-2">
              {transcribeStatus.localAvailable && (
                <button
                  type="button"
                  onClick={() => setTranscribeMode("local")}
                  className={`rounded-lg px-3 py-2 text-sm text-left ${
                    transcribeMode === "local"
                      ? "bg-cyan-600/25 text-cyan-200 border border-cyan-500/35"
                      : "bg-white/5 text-white/50 border border-white/8"
                  }`}
                >
                  <span className="block font-medium">本地转写</span>
                  <span className="block text-[10px] opacity-60 mt-0.5">faster-whisper · 无需 API</span>
                </button>
              )}
              {transcribeStatus.apiAvailable && (
                <button
                  type="button"
                  onClick={() => setTranscribeMode("api")}
                  className={`rounded-lg px-3 py-2 text-sm text-left ${
                    transcribeMode === "api"
                      ? "bg-violet-600/25 text-violet-200 border border-violet-500/35"
                      : "bg-white/5 text-white/50 border border-white/8"
                  }`}
                >
                  <span className="block font-medium">云端转写</span>
                  <span className="block text-[10px] opacity-60 mt-0.5">
                    火山方舟
                    {transcribeStatus.apiModel ? ` · ${transcribeStatus.apiModel}` : ""}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

      {tab !== "edit" && (
        <>
          <label className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-8 cursor-pointer hover:border-cyan-500/35 hover:bg-cyan-500/5 transition-all">
            <span className="text-3xl opacity-60">📝</span>
            <span className="text-sm text-white/50">{file?.name ?? "上传视频或音频"}</span>
            <input
              type="file"
              accept="video/*,audio/*"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setError(null);
              }}
            />
          </label>

          {tab === "transcribe" && (
            <div>
              <label className="block text-sm text-white/60 mb-2">输出格式</label>
              <div className="flex flex-wrap gap-2">
                {(["srt", "vtt", "text"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className={`rounded-lg px-3 py-1.5 text-sm uppercase ${
                      format === f
                        ? "bg-cyan-600/25 text-cyan-200 border border-cyan-500/35"
                        : "bg-white/5 text-white/50 border border-white/8"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {(tab === "edit" || srtText) && (
        <div className="space-y-3">
          <label htmlFor="srt-edit" className="block text-sm text-white/60">
            字幕内容（SRT）
          </label>
          <textarea
            id="srt-edit"
            value={srtText}
            onChange={(e) => setSrtText(e.target.value)}
            rows={12}
            className="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white font-mono focus:border-cyan-500/40 focus:outline-none"
            placeholder="1&#10;00:00:00,000 --> 00:00:02,000&#10;示例字幕"
          />
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[120px]">
              <label htmlFor="shift" className="block text-xs text-white/50 mb-1">
                时间平移（秒）
              </label>
              <input
                id="shift"
                type="number"
                step={0.1}
                value={shiftSec}
                onChange={(e) => setShiftSec(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              />
            </div>
            <button
              type="button"
              onClick={handleShift}
              disabled={!srtText.trim()}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/70 hover:bg-white/5 disabled:opacity-40"
            >
              应用平移
            </button>
            <button
              type="button"
              onClick={() => handleExport("srt")}
              disabled={!srtText.trim()}
              className="rounded-lg border border-cyan-500/30 px-4 py-2 text-sm text-cyan-200/90 hover:bg-cyan-500/10 disabled:opacity-40"
            >
              下载 SRT
            </button>
            <button
              type="button"
              onClick={() => handleExport("vtt")}
              disabled={!srtText.trim()}
              className="rounded-lg border border-cyan-500/30 px-4 py-2 text-sm text-cyan-200/90 hover:bg-cyan-500/10 disabled:opacity-40"
            >
              下载 VTT
            </button>
          </div>
        </div>
      )}

      {message && <p className="text-sm text-emerald-400/90 text-center">{message}</p>}
      {error && <p className="text-sm text-red-400/90 text-center">{error}</p>}

      {tab !== "edit" && (
        <ActionButton
          label={tab === "transcribe" ? "开始转写" : "提取字幕"}
          loading={loading}
          disabled={
            !file ||
            (tab === "transcribe" &&
              transcribeStatus !== null &&
              (!transcribeStatus.available || !selectedModeAvailable))
          }
          onClick={primaryAction}
        />
      )}

      <p className="text-center text-xs text-white/25 leading-relaxed">
        {tab === "transcribe"
          ? "本地转写无需 API Key；云端转写需在服务器配置 ARK_API_KEY。支持 SRT、VTT、纯文本"
          : "提取内嵌字幕需视频本身带有字幕轨"}
      </p>
    </div>
  );
}
