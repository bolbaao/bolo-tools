"use client";

import { ApiError, apiGet } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

type Platform = "douyin" | "xiaohongshu";

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
  const [list, setList] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: Platform) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<{
        ok: boolean;
        list: TrendItem[];
        source?: string;
        notice?: string;
        updatedAt?: string;
      }>(`/api/trends/${p}`);
      setList(data.list || []);
      setUpdatedAt(data.updatedAt || null);
      setNotice(data.notice || null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载失败");
      setList([]);
      setUpdatedAt(null);
      setNotice(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(platform);
  }, [platform, load]);

  const copyTopic = (rank: number, title: string) => {
    navigator.clipboard?.writeText(title).catch(() => {});
    setCopied(rank);
    setTimeout(() => setCopied(null), 1500);
  };

  const active = platforms.find((p) => p.id === platform)!;

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

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/40">
        <span>
          {loading
            ? "加载中…"
            : `${active.label} · 共 ${list.length} 条${updatedAt ? ` · 更新于 ${formatUpdatedAt(updatedAt)}` : ""}`}
        </span>
        <button
          type="button"
          onClick={() => void load(platform)}
          disabled={loading}
          className="text-violet-300/80 hover:text-violet-200 disabled:opacity-40"
        >
          刷新
        </button>
      </div>

      {notice && <p className="text-xs text-white/35 leading-relaxed">{notice}</p>}
      {error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-300/90">
          {error}
        </p>
      )}

      {!loading && !error && list.length === 0 && (
        <p className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-10 text-center text-sm text-white/40">
          暂无热点数据，请稍后刷新
        </p>
      )}

      <ul className="space-y-2">
        {list.map((item) => (
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
                onClick={() => copyTopic(item.rank, item.title)}
                className="rounded-lg px-2.5 py-1 text-xs border border-white/10 text-white/50 hover:text-violet-300 hover:border-violet-500/30 transition-colors"
              >
                {copied === item.rank ? "已复制" : "复制"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
