"use client";

import ActionButton from "@/components/ActionButton";
import { ApiError, apiGet } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

const categories = ["全部", "电影", "剧集", "综艺", "动漫"] as const;

type MediaItem = {
  id: number;
  mediaType: string;
  title: string;
  year: string;
  type: string;
  score: string;
  overview: string;
  poster: string | null;
  backdrop: string | null;
  tmdbUrl: string;
  genres?: string;
  cast?: string[];
  runtime?: number | null;
  tagline?: string;
};

export default function MediaSearchPanel() {
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("全部");
  const [results, setResults] = useState<MediaItem[] | null>(null);
  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"trending" | "search">("trending");

  const loadTrending = useCallback(async () => {
    setTrendingLoading(true);
    try {
      const data = await apiGet<{ ok: boolean; results: MediaItem[] }>("/api/media/trending");
      setTrending(data.results);
      if (mode === "trending") setResults(data.results);
    } catch {
      setTrending([]);
    } finally {
      setTrendingLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    void loadTrending();
  }, [loadTrending]);

  const handleSearch = async () => {
    if (!keyword.trim()) return;
    setLoading(true);
    setError(null);
    setSelected(null);
    setMode("search");
    try {
      const params = new URLSearchParams({
        q: keyword.trim(),
        category,
      });
      const data = await apiGet<{ ok: boolean; results: MediaItem[]; total?: number }>(
        `/api/media/search?${params}`,
      );
      setResults(data.results);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "搜索失败");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (item: MediaItem) => {
    setSelected(item);
    setDetailLoading(true);
    try {
      const params = new URLSearchParams({
        id: String(item.id),
        type: item.mediaType,
      });
      const data = await apiGet<{ ok: boolean; item: MediaItem }>(`/api/media/detail?${params}`);
      setSelected(data.item);
    } catch {
      /* 保留列表数据 */
    } finally {
      setDetailLoading(false);
    }
  };

  const copyInfo = (item: MediaItem) => {
    const text = [
      `${item.title} (${item.year})`,
      `${item.type} · 评分 ${item.score}`,
      item.genres,
      item.overview,
      item.tmdbUrl,
    ]
      .filter(Boolean)
      .join("\n");
    void navigator.clipboard?.writeText(text);
  };

  const displayList = results ?? (mode === "trending" ? trending : []);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-indigo-500/15 bg-gradient-to-br from-indigo-500/10 to-blue-600/5 px-5 py-4">
        <p className="text-sm text-white/70 leading-relaxed">
          接入 <span className="text-indigo-300">TMDB</span> 影视数据库，搜索片名即可查看海报、评分、简介，并跳转官方详情页。
        </p>
      </div>

      <div>
        <label htmlFor="media-keyword" className="block text-sm text-white/60 mb-2">
          搜索片名
        </label>
        <div className="flex gap-2">
          <input
            id="media-keyword"
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleSearch()}
            placeholder="例如：星际穿越、庆余年、鬼灭之刃…"
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-white/60 mb-2">类型</label>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-lg px-3 py-1.5 text-sm transition-all ${
                category === c
                  ? "bg-indigo-600/30 text-indigo-100 border border-indigo-500/40"
                  : "bg-white/5 text-white/50 border border-white/8 hover:bg-white/10"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-400/90 text-center">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <ActionButton
          label="搜索"
          loading={loading}
          loadingLabel="检索中…"
          disabled={!keyword.trim()}
          onClick={handleSearch}
          className="!from-indigo-600 !to-blue-700 !shadow-indigo-600/20 sm:flex-1"
        />
        <button
          type="button"
          onClick={() => {
            setKeyword("");
            setMode("trending");
            setResults(trending);
            setSelected(null);
            setError(null);
          }}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60 hover:bg-white/10 sm:flex-1"
        >
          看今日热门
        </button>
      </div>

      <p className="text-center text-[11px] text-white/25">
        数据来自 TMDB · 请在 .env 配置 TMDB_API_KEY
      </p>

      {(trendingLoading && mode === "trending") || loading ? (
        <p className="text-center text-sm text-white/35 py-12">加载中…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,280px)]">
          <div>
            <p className="text-xs text-white/40 mb-3">
              {mode === "trending" ? "今日热门" : "搜索结果"} · {displayList.length} 条
            </p>
            {displayList.length === 0 ? (
              <p className="text-center text-sm text-white/40 py-10">无匹配结果，换个关键词试试</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {displayList.map((item) => (
                  <li key={`${item.mediaType}-${item.id}`}>
                    <button
                      type="button"
                      onClick={() => void openDetail(item)}
                      className={`w-full text-left rounded-xl border p-3 transition-all hover:bg-white/[0.04] ${
                        selected?.id === item.id && selected?.mediaType === item.mediaType
                          ? "border-indigo-500/40 bg-indigo-500/10 ring-1 ring-indigo-500/25"
                          : "border-white/8 bg-white/[0.02]"
                      }`}
                    >
                      <div className="flex gap-3">
                        {item.poster ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.poster}
                            alt=""
                            className="w-14 h-[5.25rem] object-cover rounded-lg shrink-0 bg-white/5"
                          />
                        ) : (
                          <div className="w-14 h-[5.25rem] rounded-lg bg-white/5 shrink-0 flex items-center justify-center text-lg opacity-40">
                            🎬
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white/90 line-clamp-2">{item.title}</p>
                          <p className="text-xs text-white/40 mt-1">
                            {item.type} · {item.year} · ★ {item.score}
                          </p>
                          {item.overview && (
                            <p className="text-[11px] text-white/30 mt-1.5 line-clamp-2">{item.overview}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <aside className="lg:sticky lg:top-20 lg:self-start">
            {selected ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                {selected.backdrop || selected.poster ? (
                  <div className="relative h-32 bg-black/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selected.backdrop || selected.poster!}
                      alt=""
                      className="h-full w-full object-cover opacity-80"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
                  </div>
                ) : null}
                <div className="p-4 space-y-3">
                  {detailLoading && (
                    <p className="text-xs text-white/35">加载详情…</p>
                  )}
                  <h3 className="text-lg font-semibold text-white leading-snug">{selected.title}</h3>
                  {selected.tagline && (
                    <p className="text-xs text-white/45 italic">{selected.tagline}</p>
                  )}
                  <p className="text-xs text-white/50">
                    {selected.type} · {selected.year} · ★ {selected.score}
                    {selected.runtime ? ` · ${selected.runtime} 分钟` : ""}
                  </p>
                  {selected.genres && (
                    <p className="text-xs text-indigo-300/80">{selected.genres}</p>
                  )}
                  {selected.cast && selected.cast.length > 0 && (
                    <p className="text-xs text-white/40">主演：{selected.cast.join("、")}</p>
                  )}
                  {selected.overview && (
                    <p className="text-sm text-white/55 leading-relaxed">{selected.overview}</p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <a
                      href={selected.tmdbUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg px-3 py-1.5 text-xs text-indigo-200 bg-indigo-500/15 ring-1 ring-indigo-500/25 hover:bg-indigo-500/25"
                    >
                      TMDB 详情
                    </a>
                    <button
                      type="button"
                      onClick={() => copyInfo(selected)}
                      className="rounded-lg px-3 py-1.5 text-xs text-white/60 ring-1 ring-white/10 hover:bg-white/5"
                    >
                      复制信息
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/12 px-4 py-10 text-center text-sm text-white/35">
                点击左侧条目查看详情
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
