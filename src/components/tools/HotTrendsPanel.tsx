"use client";

import { ApiError, apiGet } from "@/lib/api";
import { useAgentPrefill } from "@/hooks/useAgentPrefill";
import {
  isTrendFavorited,
  loadFavoriteTrends,
  saveFavoriteTrends,
  toggleFavoriteTrend,
  type FavoriteTrend,
} from "@/lib/hot-trends-favorites";
import { useCallback, useEffect, useState } from "react";

type Platform = "douyin" | "xiaohongshu";
type ViewMode = "trends" | "favorites";

type TrendItem = {
  rank: number;
  title: string;
  heat: string;
  tag: string;
  author?: string;
  url?: string;
};

const platforms: { id: Platform; label: string; desc: string; color: string }[] = [
  {
    id: "douyin",
    label: "抖音",
    desc: "实时热搜词",
    color: "from-gray-800 to-gray-900 border-white/15",
  },
  {
    id: "xiaohongshu",
    label: "小红书",
    desc: "探索页热门笔记",
    color: "from-red-600/30 to-rose-600/20 border-red-500/35",
  },
];

function formatUpdatedAt(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HotTrendsPanel() {
  const [platform, setPlatform] = useState<Platform>("douyin");
  const [viewMode, setViewMode] = useState<ViewMode>("trends");
  const [list, setList] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<FavoriteTrend[]>([]);

  useEffect(() => {
    setFavorites(loadFavoriteTrends());
  }, []);

  const persistFavorites = (next: FavoriteTrend[]) => {
    setFavorites(next);
    saveFavoriteTrends(next);
  };

  const load = useCallback(async (p: Platform, { force = false } = {}) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const query = force ? "?refresh=1" : "";
      const data = await apiGet<{
        ok: boolean;
        list: TrendItem[];
        source?: string;
        notice?: string;
        updatedAt?: string;
      }>(`/api/trends/${p}${query}`);
      setList(data.list || []);
      setUpdatedAt(data.updatedAt || null);
      setSource(data.source || null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载失败");
      setList([]);
      setUpdatedAt(null);
      setSource(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useAgentPrefill("hot-trends", {
    apply: (fields) => {
      if (fields.platform === "douyin" || fields.platform === "xiaohongshu") {
        setPlatform(fields.platform);
      }
    },
    canSubmit: (fields) =>
      fields.platform === "douyin" || fields.platform === "xiaohongshu",
    submit: (fields) => {
      const p = fields.platform as Platform;
      if (p === "douyin" || p === "xiaohongshu") void load(p);
    },
  });

  useEffect(() => {
    if (viewMode === "trends") void load(platform);
  }, [platform, viewMode, load]);

  const copyTopic = (key: string, title: string) => {
    navigator.clipboard?.writeText(title).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const toggleFavorite = (item: TrendItem) => {
    const next = toggleFavoriteTrend(favorites, {
      platform,
      title: item.title,
      rank: item.rank,
      heat: item.heat,
      tag: item.tag,
      author: item.author,
      url: item.url,
    });
    persistFavorites(next);
  };

  const toggleFavoriteSaved = (fav: FavoriteTrend) => {
    persistFavorites(toggleFavoriteTrend(favorites, fav));
  };

  const active = platforms.find((p) => p.id === platform)!;
  const favoriteList =
    viewMode === "favorites"
      ? favorites.filter((f) => f.platform === platform)
      : [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2">
        {platforms.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPlatform(p.id)}
            className={`rounded-xl border px-3 py-3 text-left transition-all bg-gradient-to-br ${
              platform === p.id
                ? `${p.color} text-white shadow-lg`
                : "bg-white/5 border-white/8 text-white/50 hover:bg-white/10"
            }`}
          >
            <span className="block text-sm font-medium">{p.label}</span>
            <span className="mt-1 block text-[11px] text-white/45">{p.desc}</span>
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setViewMode("trends")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm transition-all ${
            viewMode === "trends"
              ? "bg-violet-600/25 text-violet-200 border border-violet-500/35"
              : "bg-white/5 text-white/50 border border-white/8 hover:bg-white/10"
          }`}
        >
          实时榜单
        </button>
        <button
          type="button"
          onClick={() => setViewMode("favorites")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm transition-all ${
            viewMode === "favorites"
              ? "bg-amber-600/25 text-amber-200 border border-amber-500/35"
              : "bg-white/5 text-white/50 border border-white/8 hover:bg-white/10"
          }`}
        >
          我的收藏
          {favorites.length > 0 && (
            <span className="ml-1 text-[11px] opacity-70">({favorites.length})</span>
          )}
        </button>
      </div>

      {viewMode === "trends" && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/40">
          <span>
            {loading
              ? "加载中…"
              : `${active.label} · 共 ${list.length} 条${updatedAt ? ` · 更新于 ${formatUpdatedAt(updatedAt)}` : ""}${source === "live" && refreshing ? " · 已强制刷新" : ""}`}
          </span>
          <button
            type="button"
            onClick={() => void load(platform, { force: true })}
            disabled={loading || refreshing}
            className="text-violet-300/80 hover:text-violet-200 disabled:opacity-40"
          >
            {refreshing ? "刷新中…" : "刷新"}
          </button>
        </div>
      )}

      {viewMode === "favorites" && (
        <p className="text-xs text-white/40">
          {active.label} 收藏 · 共 {favoriteList.length} 条（本地保存）
        </p>
      )}

      {error && viewMode === "trends" && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-300/90">
          {error}
        </p>
      )}

      {viewMode === "trends" && !loading && !error && list.length === 0 && (
        <p className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-10 text-center text-sm text-white/40">
          暂无热点数据，请稍后刷新
        </p>
      )}

      {viewMode === "favorites" && favoriteList.length === 0 && (
        <p className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-10 text-center text-sm text-white/40">
          还没有收藏，在榜单中点击 ☆ 即可收藏
        </p>
      )}

      <ul className="space-y-2">
        {viewMode === "trends"
          ? list.map((item) => (
              <li
                key={`${platform}-${item.rank}-${item.title}`}
                className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3.5 hover:bg-white/[0.04] transition-colors"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    item.rank <= 3
                      ? "bg-gradient-to-br from-amber-500/40 to-orange-600/30 text-amber-200"
                      : "bg-white/8 text-white/50"
                  }`}
                >
                  {item.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white/90 line-clamp-2">{item.title}</p>
                  <p className="text-xs text-white/35 mt-0.5">
                    {item.heat}
                    {item.author ? ` · @${item.author}` : ""}
                    {item.tag ? ` · ${item.tag}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleFavorite(item)}
                    title={isTrendFavorited(favorites, platform, item.title) ? "取消收藏" : "收藏"}
                    className={`rounded-lg px-2 py-1 text-xs border transition-colors ${
                      isTrendFavorited(favorites, platform, item.title)
                        ? "border-amber-500/40 text-amber-300 bg-amber-500/10"
                        : "border-white/10 text-white/45 hover:text-amber-300 hover:border-amber-500/30"
                    }`}
                  >
                    {isTrendFavorited(favorites, platform, item.title) ? "★" : "☆"}
                  </button>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg px-2.5 py-1 text-xs border border-white/10 text-white/45 hover:text-white/70 hover:border-white/20 transition-colors"
                    >
                      打开
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => copyTopic(`${platform}-${item.rank}`, item.title)}
                    className="rounded-lg px-2.5 py-1 text-xs border border-white/10 text-white/50 hover:text-violet-300 hover:border-violet-500/30 transition-colors"
                  >
                    {copiedKey === `${platform}-${item.rank}` ? "已复制" : "复制"}
                  </button>
                </div>
              </li>
            ))
          : favoriteList.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3.5 hover:bg-white/[0.04] transition-colors"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-xs text-amber-200">
                  ★
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white/90 line-clamp-2">{item.title}</p>
                  <p className="text-xs text-white/35 mt-0.5">
                    {item.heat || "—"}
                    {item.author ? ` · @${item.author}` : ""}
                    {item.tag ? ` · ${item.tag}` : ""}
                    {item.savedAt ? ` · 收藏于 ${formatUpdatedAt(item.savedAt)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg px-2.5 py-1 text-xs border border-white/10 text-white/45 hover:text-white/70 hover:border-white/20 transition-colors"
                    >
                      打开
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => copyTopic(item.id, item.title)}
                    className="rounded-lg px-2.5 py-1 text-xs border border-white/10 text-white/50 hover:text-violet-300 hover:border-violet-500/30 transition-colors"
                  >
                    {copiedKey === item.id ? "已复制" : "复制"}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFavoriteSaved(item)}
                    className="rounded-lg px-2 py-1 text-xs border border-amber-500/30 text-amber-300/80 hover:text-amber-200"
                  >
                    取消
                  </button>
                </div>
              </li>
            ))}
      </ul>
    </div>
  );
}
