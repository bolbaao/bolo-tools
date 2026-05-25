"use client";

import { useState } from "react";

const mockAssets = [
  { id: 1, name: "intro-bgm.mp3", type: "音频", size: "4.2 MB", date: "2026-05-20" },
  { id: 2, name: "cover-draft.png", type: "图片", size: "1.8 MB", date: "2026-05-22" },
  { id: 3, name: "vlog-clip-01.mp4", type: "视频", size: "128 MB", date: "2026-05-24" },
  { id: 4, name: "podcast-ep3.wav", type: "音频", size: "52 MB", date: "2026-05-18" },
];

const tabs = ["全部", "音频", "视频", "图片"];

export default function AssetsPanel() {
  const [activeTab, setActiveTab] = useState("全部");
  const [search, setSearch] = useState("");

  const filtered = mockAssets.filter((a) => {
    const matchTab = activeTab === "全部" || a.type === activeTab;
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索素材…"
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-violet-500/50 focus:outline-none"
        />
        <button
          type="button"
          className="rounded-xl border border-dashed border-violet-500/30 bg-violet-500/10 px-5 py-2.5 text-sm text-violet-300 hover:bg-violet-500/15 transition-colors whitespace-nowrap"
        >
          + 上传素材
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-lg px-3 py-1.5 text-sm transition-all ${
              activeTab === tab
                ? "bg-rose-600/25 text-rose-200 border border-rose-500/35"
                : "bg-white/5 text-white/50 border border-white/8 hover:bg-white/10"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <ul className="divide-y divide-white/5 rounded-xl border border-white/8 overflow-hidden">
        {filtered.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-white/35">暂无匹配素材</li>
        ) : (
          filtered.map((asset) => (
            <li
              key={asset.id}
              className="flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-white/[0.03] transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white/90 truncate">{asset.name}</p>
                <p className="text-xs text-white/35 mt-0.5">
                  {asset.type} · {asset.size} · {asset.date}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  className="rounded-lg px-3 py-1 text-xs text-white/50 border border-white/10 hover:bg-white/5"
                >
                  预览
                </button>
                <button
                  type="button"
                  className="rounded-lg px-3 py-1 text-xs text-violet-300 border border-violet-500/25 hover:bg-violet-500/10"
                >
                  使用
                </button>
              </div>
            </li>
          ))
        )}
      </ul>

      <p className="text-xs text-white/25 text-center">
        共 {filtered.length} 项 · 素材库为演示数据
      </p>
    </div>
  );
}
