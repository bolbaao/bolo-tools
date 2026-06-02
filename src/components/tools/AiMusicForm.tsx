"use client";

import ActionButton from "@/components/ActionButton";
import { useAgentPrefill } from "@/hooks/useAgentPrefill";
import { ApiError, apiGet, apiPost, downloadBlob } from "@/lib/api";
import { AI_SERVICE_UNAVAILABLE } from "@/lib/service-message";
import { useCallback, useEffect, useMemo, useState } from "react";

type Track = {
  id: string;
  title: string;
  audioUrl?: string;
  audioBase64?: string;
  mimeType?: string;
  imageUrl?: string;
  tags?: string;
  duration?: number | null;
  lyrics?: string;
  demo?: boolean;
};

type Capabilities = {
  ok: boolean;
  configured: boolean;
  suno?: boolean;
  demo?: boolean;
  mode?: "suno" | "demo" | "none";
  provider?: string | null;
  presets?: { id: string; label: string; baseUrl: string; docs: string }[];
};

type Mode = "inspiration" | "lyrics";

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "inspiration", label: "灵感模式", hint: "一句话描述，AI 自动写词作曲" },
  { id: "lyrics", label: "歌词模式", hint: "自己写歌词，指定风格" },
];

const STYLE_PRESETS = ["pop, chinese", "rock, energetic", "lofi, chill", "electronic, dance", "folk, acoustic", "jazz, smooth"];

const EXAMPLE_PROMPTS = [
  "一首关于夏天海边的轻快流行歌，女声",
  "深夜加班时的 Lo-Fi 纯音乐，适合专注",
  "给朋友的生日祝福歌，温暖治愈",
];

function trackAudioSrc(track: Track): string {
  if (track.audioUrl) return track.audioUrl;
  if (track.audioBase64) {
    return `data:${track.mimeType || "audio/mpeg"};base64,${track.audioBase64}`;
  }
  return "";
}

export default function AiMusicForm() {
  const [mode, setMode] = useState<Mode>("inspiration");
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState(STYLE_PRESETS[0]);
  const [title, setTitle] = useState("");
  const [instrumental, setInstrumental] = useState(false);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const applyPrefill = useCallback((fields: Record<string, string>) => {
    if (fields.prompt) setPrompt(fields.prompt);
    if (fields.style) setStyle(fields.style);
    if (fields.title) setTitle(fields.title);
    if (fields.mode === "lyrics") setMode("lyrics");
  }, []);
  useAgentPrefill("ai-music", applyPrefill);

  useEffect(() => {
    apiGet<Capabilities>("/api/ai-music/capabilities")
      .then(setCaps)
      .catch(() => setCaps(null));
  }, []);

  const loadingLabel = useMemo(() => {
    if (caps?.mode === "demo") return "AI 作词并合成演示旋律…";
    return "AI 作曲中，通常需 1–3 分钟…";
  }, [caps?.mode]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    setTracks([]);
    try {
      const data = await apiPost<{ ok: boolean; tracks: Track[]; message?: string }>(
        "/api/ai-music/generate",
        {
          prompt: prompt.trim(),
          style,
          title: title.trim() || undefined,
          instrumental,
          mode,
        },
        { timeoutMs: caps?.mode === "demo" ? 120000 : 360000 },
      );
      setTracks(data.tracks || []);
      setMessage(data.message || "生成完成");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "生成失败");
    } finally {
      setLoading(false);
    }
  };

  const downloadTrack = async (track: Track) => {
    const src = trackAudioSrc(track);
    if (!src) return;
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const ext = blob.type.includes("mpeg") ? "mp3" : blob.type.includes("wav") ? "wav" : "mp3";
      downloadBlob(blob, `${track.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")}.${ext}`);
    } catch {
      if (track.audioUrl) window.open(track.audioUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-fuchsia-500/15 bg-fuchsia-500/5 px-5 py-4">
        <p className="text-sm text-white/65 leading-relaxed">
          输入文字描述或歌词，AI 自动生成完整歌曲。支持灵感模式（一句话成曲）与歌词模式（自定义词作）。
        </p>
      </div>

      {caps && !caps.configured && (
        <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-amber-100/85">
          {AI_SERVICE_UNAVAILABLE}
        </p>
      )}

      {caps?.mode === "demo" && (
        <p className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3 text-xs leading-relaxed text-violet-100/85">
          当前为预览模式：将生成歌词与旋律小样。完整人声成曲功能开通后即可使用。
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/8">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              setMode(m.id);
              setError(null);
            }}
            className={`flex-1 min-w-[8rem] rounded-lg px-2 py-2.5 text-center transition-all ${
              mode === m.id
                ? "bg-fuchsia-600/25 text-fuchsia-100 border border-fuchsia-500/30"
                : "text-white/45 hover:text-white/70 hover:bg-white/5"
            }`}
          >
            <span className="block text-sm font-medium">{m.label}</span>
            <span className="block text-[10px] opacity-60 mt-0.5">{m.hint}</span>
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="music-prompt" className="block text-sm text-white/60 mb-2">
          {mode === "inspiration" ? "创作灵感" : "歌词内容"}
        </label>
        <textarea
          id="music-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, mode === "lyrics" ? 3000 : 500))}
          rows={mode === "lyrics" ? 10 : 4}
          placeholder={
            mode === "inspiration"
              ? "描述你想要的歌曲：主题、情绪、风格、场景…"
              : "输入歌词，可用 [Verse]、[Chorus] 等段落标记…"
          }
          className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-fuchsia-500/50 focus:outline-none focus:ring-1 focus:ring-fuchsia-500/30 font-mono"
        />
        <p className="mt-1 text-right text-xs text-white/25">
          {prompt.length} / {mode === "lyrics" ? 3000 : 500}
        </p>
      </div>

      {mode === "lyrics" && (
        <div>
          <label htmlFor="music-title" className="block text-sm text-white/60 mb-2">
            歌曲标题
          </label>
          <input
            id="music-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 80))}
            placeholder="我的歌曲"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-fuchsia-500/50 focus:outline-none focus:ring-1 focus:ring-fuchsia-500/30"
          />
        </div>
      )}

      <div>
        <label className="block text-sm text-white/60 mb-2">音乐风格</label>
        <div className="flex flex-wrap gap-2">
          {STYLE_PRESETS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStyle(s)}
              className={`rounded-lg px-3 py-1.5 text-xs ${
                style === s
                  ? "bg-fuchsia-600/30 text-fuchsia-100 ring-1 ring-fuchsia-500/40"
                  : "bg-white/5 text-white/50 hover:bg-white/8"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {mode === "inspiration" && (
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={instrumental}
            onChange={(e) => setInstrumental(e.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-white/5 text-fuchsia-500 focus:ring-fuchsia-500/30"
          />
          <span className="text-sm text-white/60">纯音乐（无人声）</span>
        </label>
      )}

      <div className="flex flex-wrap gap-2">
        {EXAMPLE_PROMPTS.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setPrompt(ex)}
            className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/45 hover:bg-white/8 hover:text-white/65 transition-colors"
          >
            {ex.slice(0, 18)}…
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200/90">
          {error}
        </p>
      )}

      {message && tracks.length > 0 && (
        <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-200/90">
          {message}
        </p>
      )}

      <ActionButton
        label="开始创作"
        loadingLabel={loadingLabel}
        onClick={handleGenerate}
        disabled={!prompt.trim() || caps?.configured === false}
        loading={loading}
      />

      {tracks.length > 0 && (
        <ul className="space-y-4">
          {tracks.map((track) => {
            const audioSrc = trackAudioSrc(track);
            return (
              <li
                key={track.id || audioSrc}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start gap-4">
                  {track.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={track.imageUrl}
                      alt=""
                      className="h-16 w-16 rounded-xl object-cover ring-1 ring-white/10"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-fuchsia-500/15 text-2xl ring-1 ring-fuchsia-500/20">
                      ♪
                    </div>
                  )}
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-medium text-white/90">{track.title}</h3>
                      {track.demo && (
                        <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] text-violet-200 ring-1 ring-violet-500/25">
                          演示
                        </span>
                      )}
                    </div>
                    {track.tags && <p className="mt-1 text-xs text-white/40">{track.tags}</p>}
                    {audioSrc && (
                      <audio controls src={audioSrc} className="mt-3 w-full" preload="metadata">
                        您的浏览器不支持音频播放
                      </audio>
                    )}
                  </div>
                </div>
                {track.lyrics && (
                  <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-white/8 bg-black/20 p-4 text-xs leading-relaxed text-white/55 font-mono">
                    {track.lyrics}
                  </pre>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void downloadTrack(track)}
                    className="rounded-lg bg-white/5 px-4 py-2 text-xs text-white/70 hover:bg-white/10 transition-colors"
                  >
                    下载音频
                  </button>
                  {track.audioUrl && (
                    <a
                      href={track.audioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-white/5 px-4 py-2 text-xs text-white/70 hover:bg-white/10 transition-colors"
                    >
                      新窗口打开
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
