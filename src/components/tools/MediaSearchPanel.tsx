"use client";

import ActionButton from "@/components/ActionButton";
import { ApiError, apiGet } from "@/lib/api";
import { useState } from "react";

const categories = ["全部", "电影", "剧集", "综艺", "动漫"];

type MediaItem = {
  id: number;
  title: string;
  year: string;
  type: string;
  quality: string;
  score: string;
  overview: string;
  poster: string | null;
};

export default function MediaSearchPanel() {
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("全部");
  const [results, setResults] = useState<MediaItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!keyword.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        q: keyword.trim(),
        category,
      });
      const data = await apiGet<{ ok: boolean; results: MediaItem[] }>(
        `/api/media/search?${params}`,
      );
      setResults(data.results);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "搜索失败");
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const copyInfo = (item: MediaItem) => {
    const text = `${item.title} (${item.year}) · ${item.type} · 评分 ${item.score}\n${item.overview}`;
    navigator.clipboard?.writeText(text).catch(() => {});
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
          onKeyDown={(e) => e.key === "Enter" && void handleSearch()}
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

      {error && <p className="text-sm text-red-400/90 text-center">{error}</p>}

      <ActionButton
        label={results ? "重新搜索" : "搜索影视"}
        loading={loading}
        disabled={!keyword.trim()}
        onClick={handleSearch}
      />

      <p className="text-center text-xs text-white/25">
        数据来源 TMDB · 请在 .env 配置 TMDB_API_KEY
      </p>

      {results && (
        <ul className="space-y-2 border-t border-white/8 pt-4">
          <p className="text-xs text-white/40 mb-3">找到 {results.length} 条结果</p>
          {results.length === 0 ? (
            <li className="text-center text-sm text-white/40 py-6">无匹配结果</li>
          ) : (
            results.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3.5 hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex gap-3">
                  {item.poster && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.poster}
                      alt=""
                      className="w-14 h-20 object-cover rounded-lg shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white/90">{item.title}</p>
                    <p className="text-xs text-white/40 mt-1">
                      {item.type} · {item.year} · 评分 {item.score}
                    </p>
                    {item.overview && (
                      <p className="text-xs text-white/35 mt-2 line-clamp-2">{item.overview}</p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => copyInfo(item)}
                    className="rounded-lg px-3 py-1 text-xs text-blue-300 border border-blue-500/25 hover:bg-blue-500/10"
                  >
                    复制信息
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
