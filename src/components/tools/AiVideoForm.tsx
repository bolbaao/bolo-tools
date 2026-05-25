"use client";

import MockButton from "@/components/MockButton";
import { useState } from "react";

const styles = ["电影感", "动漫", "写实", "赛博朋克", "水彩"];

export default function AiVideoForm() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("电影感");
  const [duration, setDuration] = useState("15");

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="prompt" className="block text-sm text-white/60 mb-2">
          创意描述
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="描述你想要的画面，例如：日落下的城市天际线，镜头缓缓推进…"
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

      <MockButton
        label="生成视频"
        successMessage={`「${style}」风格视频已加入生成队列（演示）`}
      />
    </div>
  );
}
