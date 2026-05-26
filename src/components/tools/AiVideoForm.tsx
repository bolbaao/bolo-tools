"use client";

import ActionButton from "@/components/ActionButton";
import { useAgentPrefill } from "@/hooks/useAgentPrefill";
import { ApiError, apiPost } from "@/lib/api";
import { useCallback, useState } from "react";

const styles = ["电影感", "动漫", "写实", "赛博朋克", "水彩"];

export default function AiVideoForm() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("电影感");
  const [duration, setDuration] = useState("15");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const applyPrefill = useCallback((fields: Record<string, string>) => {
    if (fields.prompt) setPrompt(fields.prompt);
  }, []);
  useAgentPrefill("ai-video", applyPrefill);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setVideoUrl(null);
    setMessage(null);
    try {
      const data = await apiPost<{
        ok: boolean;
        videoUrl?: string | null;
        message?: string;
        status?: string;
      }>("/api/ai-video/generate", {
        prompt: prompt.trim(),
        style,
        duration,
      });
      setMessage(data.message || "任务已提交");
      if (data.videoUrl) setVideoUrl(data.videoUrl);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "生成失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="prompt" className="block text-sm text-white/60 mb-2">
          创意描述
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, 500))}
          rows={4}
          placeholder="描述你想要的画面…"
          className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
        />
        <p className="mt-1 text-right text-xs text-white/25">{prompt.length} / 500</p>
      </div>

      <div>
        <label className="block text-sm text-white/60 mb-2">画面风格</label>
        <div className="flex flex-wrap gap-2">
          {styles.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStyle(s)}
              className={`rounded-lg px-3 py-1.5 text-sm transition-all ${
                style === s
                  ? "bg-amber-600/25 text-amber-200 border border-amber-500/35"
                  : "bg-white/5 text-white/50 border border-white/8 hover:bg-white/10"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="duration" className="block text-sm text-white/60 mb-2">
          视频时长：{duration} 秒
        </label>
        <input
          id="duration"
          type="range"
          min={5}
          max={60}
          step={5}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="w-full accent-violet-500"
        />
      </div>

      {message && (
        <p className="text-sm text-emerald-400/90 text-center">{message}</p>
      )}
      {videoUrl && (
        <video
          src={videoUrl}
          controls
          className="w-full rounded-xl border border-white/10"
        />
      )}
      {error && <p className="text-sm text-red-400/90 text-center">{error}</p>}

      <ActionButton
        label="生成视频"
        loading={loading}
        disabled={!prompt.trim()}
        onClick={handleGenerate}
      />
      <p className="text-center text-xs text-white/25">
        需在 .env 配置 REPLICATE_API_TOKEN（可选功能）
      </p>
    </div>
  );
}
