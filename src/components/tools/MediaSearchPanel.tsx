"use client";

import { useState } from "react";

const categories = ["全部", "电影", "剧集", "综艺", "动漫"];

const mockResults = [
  { title: "星际远航", year: "2024", type: "电影", quality: "4K HDR", sources: 3, score: "8.6" },
  { title: "迷雾之城 第二季", year: "2025", type: "剧集", quality: "1080P", sources: 5, score: "9.1" },
  { title: "周末脱口秀", year: "2026", type: "综艺", quality: "720P", sources: 2, score: "7.8" },
  { title: "像素冒险记", year: "2023", type: "动漫", quality: "1080P", sources: 4, score: "8.9" },
];

export default function MediaSearchPanel() {
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("全部");
  const [results, setResults] = useState<typeof mockResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSearch = () => {
    setLoading(true);
    setDone(false);
    setTimeout(() => {
      let list =
        category === "全部"
          ? mockResults
          : mockResults.filter((r) => r.type === category);
      if (keyword.trim()) {
        list = list.filter((r) =>
          r.title.toLowerCase().includes(keyword.trim().toLowerCase())
        );
        if (list.length === 0) list = mockResults.slice(0, 2);
      }
      setResults(list);
      setLoading(false);
      setDone(true);
    }, 800);
  };

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="media-keyword" className="block text-sm text-white/60 mb-2">
          搜索关键词
        </label>
        <input
          id="media-keyword"
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="输入片名、演员或关键词…"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
        />
      </div>

      <div>
        <label className="block text-sm text-white/60 mb-2">资源类型</label>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-lg px-3 py-1.5 text-sm transition-all ${
                category === c
                  ? "bg-blue-600/30 text-blue-200 border border-blue-500/40"
                  : "bg-white/5 text-white/50 border border-white/8 hover:bg-white/10"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSearch}
        disabled={loading}
        className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60 shadow-lg shadow-blue-500/20 transition-all"
      >
        {loading ? "搜索中…" : done ? "重新搜索" : "搜索资源"}
      </button>
      {done && (
        <p className="text-center text-xs text-emerald-400/90">检索完成（演示数据）</p>
      )}

      {results && (
        <ul className="space-y-2 border-t border-white/8 pt-4">
          <p className="text-xs text-white/40 mb-3">找到 {results.length} 条相关资源</p>
          {results.map((item, i) => (
            <li
              key={i}
              className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3.5 hover:bg-white/[0.04] transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white/90">{item.title}</p>
                  <p className="text-xs text-white/40 mt-1">
                    {item.type} · {item.year} · {item.quality} · 评分 {item.score}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] text-blue-300">
                  {item.sources} 源
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="rounded-lg px-3 py-1 text-xs text-white/50 border border-white/10 hover:bg-white/5"
                >
                  查看详情
                </button>
                <button
                  type="button"
                  className="rounded-lg px-3 py-1 text-xs text-blue-300 border border-blue-500/25 hover:bg-blue-500/10"
                >
                  复制信息
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
