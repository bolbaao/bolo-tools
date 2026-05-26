"use client";

import { ApiError, apiGet } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

type Platform = "douyin" | "xiaohongshu";

type TrendItem = {
  rank: number;
  title: string;
  heat: string;
  tag: string;
};

const platforms: { id: Platform; label: string; color: string }[] = [
  { id: "douyin", label: "抖音", color: "from-gray-800 to-gray-900 border-white/15" },
  { id: "xiaohongshu", label: "小红书", color: "from-red-600/30 to-rose-600/20 border-red-500/35" },
];

export default function HotTrendsPanel() {
  const [platform, setPlatform] = useState<Platform>("douyin");
  const [list, setList] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
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
      setList(data.list);
      setNotice(data.notice || (data.source === "fallback" ? "实时数据暂不可用" : null));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载失败");
      setList([]);
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

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {platforms.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPlatform(p.id)}
            className={`flex-1 rounded-xl py-3 text-sm font-medium border transition-all bg-gradient-to-br ${
              platform === p.id
                ? `${p.color} text-white shadow-lg`
                : "bg-white/5 border-white/8 text-white/50 hover:bg-white/10"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-white/40">
        <span>{loading ? "加载中…" : `共 ${list.length} 条热点`}</span>
        <button
          type="button"
          onClick={() => void load(platform)}
          className="text-violet-300/80 hover:text-violet-200"
        >
          刷新
        </button>
      </div>

      {notice && <p className="text-xs text-amber-300/70 text-center">{notice}</p>}
      {error && <p className="text-xs text-red-400/80 text-center">{error}</p>}

      <ul className="space-y-2">
        {list.map((item) => (
          <li
            key={item.rank}
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
              <p className="text-sm text-white/90 truncate">{item.title}</p>
              <p className="text-xs text-white/35 mt-0.5">
                {item.heat} · {item.tag}
              </p>
            </div>
            <button
              type="button"
              onClick={() => copyTopic(item.rank, item.title)}
              className="shrink-0 rounded-lg px-3 py-1 text-xs border border-white/10 text-white/50 hover:text-violet-300 hover:border-violet-500/30 transition-colors"
            >
              {copied === item.rank ? "已复制" : "复制"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
