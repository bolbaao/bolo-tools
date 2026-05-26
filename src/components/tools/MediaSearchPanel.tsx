"use client";

import ActionButton from "@/components/ActionButton";
import { ApiError, apiGet } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

type ResourceLink = {
  id: string;
  label: string;
  url: string;
  kind: "meta" | "watch" | "search" | "rent" | "buy";
};

type AggregateResult = {
  key: string;
  title: string;
  year: string;
  type: string;
  poster: string | null;
  score: string | null;
  overview: string;
  matchedFrom: string[];
  links: ResourceLink[];
  copyText: string;
  watchCount: number;
};

type AggregateResponse = {
  ok: boolean;
  query: string;
  results: AggregateResult[];
  stats: { doubanHits: number; tmdbHits: number; merged: number };
};

export default function MediaSearchPanel() {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<AggregateResult[]>([]);
  const [stats, setStats] = useState<AggregateResponse["stats"] | null>(null);
  const [hotKeywords, setHotKeywords] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadHot = useCallback(async () => {
    try {
      const data = await apiGet<{ ok: boolean; keywords: string[] }>("/api/media/hot");
      setHotKeywords(data.keywords);
    } catch {
      setHotKeywords(["星际穿越", "庆余年", "鬼灭之刃", "奥本海默"]);
    }
  }, []);

  useEffect(() => {
    void loadHot();
  }, [loadHot]);

  const runSearch = async (q: string) => {
    const term = q.trim();
    if (!term) return;
    setLoading(true);
    setError(null);
    setKeyword(term);
    try {
      const params = new URLSearchParams({ q: term });
      const data = await apiGet<AggregateResponse>(`/api/media/aggregate-search?${params}`);
      setResults(data.results);
      setStats(data.stats);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "搜索失败");
      setResults([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const copyBundle = async (item: AggregateResult) => {
    await navigator.clipboard.writeText(item.copyText);
    setCopiedKey(item.key);
    window.setTimeout(() => setCopiedKey(null), 2000);
  };

  const linkStyle = (kind: ResourceLink["kind"]) => {
    if (kind === "watch") return "text-emerald-300/90 ring-emerald-500/25 bg-emerald-500/10";
    if (kind === "meta") return "text-indigo-300/90 ring-indigo-500/25 bg-indigo-500/10";
    return "text-white/55 ring-white/10 bg-white/5";
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-indigo-500/15 bg-indigo-500/5 px-5 py-4">
        <p className="text-sm text-white/65 leading-relaxed">
          输入片名后，将<strong className="text-white/85 font-medium">并行检索</strong>
          豆瓣与 TMDB，合并去重后为每条结果生成
          <strong className="text-white/85 font-medium">可复制的链接包</strong>
          （豆瓣、正版流媒体、各平台搜索入口）。
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void runSearch(keyword)}
          placeholder="输入影视名称…"
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
        />
        <ActionButton
          label="搜索"
          loadingLabel="检索多源中…"
          loading={loading}
          disabled={!keyword.trim()}
          onClick={() => void runSearch(keyword)}
          className="!from-indigo-600 !to-blue-700 sm:min-w-[120px]"
        />
      </div>

      {hotKeywords.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-white/35 self-center mr-1">热门</span>
          {hotKeywords.map((word) => (
            <button
              key={word}
              type="button"
              disabled={loading}
              onClick={() => void runSearch(word)}
              className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/50 ring-1 ring-white/8 hover:bg-indigo-500/15 hover:text-indigo-200/90 disabled:opacity-40"
            >
              {word}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400/90 text-center rounded-xl bg-red-500/10 px-4 py-3">
          {error}
        </p>
      )}

      {stats && !loading && (
        <p className="text-xs text-white/35 text-center">
          豆瓣 {stats.doubanHits} 条 · TMDB {stats.tmdbHits} 条 · 合并展示 {stats.merged} 条
        </p>
      )}

      {loading && (
        <p className="text-center text-sm text-white/40 py-10">正在并行检索豆瓣与 TMDB…</p>
      )}

      {!loading && results.length > 0 && (
        <ul className="space-y-4">
          {results.map((item) => (
            <li
              key={item.key}
              className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden"
            >
              <div className="flex gap-4 p-4 sm:p-5">
                {item.poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.poster}
                    alt=""
                    className="w-16 h-24 sm:w-20 sm:h-[7.5rem] object-cover rounded-xl shrink-0 bg-white/5"
                  />
                ) : (
                  <div className="w-16 h-24 sm:w-20 sm:h-[7.5rem] rounded-xl bg-white/5 shrink-0 flex items-center justify-center text-2xl opacity-30">
                    🎬
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-white/90">{item.title}</h3>
                      <p className="mt-1 text-xs text-white/40">
                        {item.type} · {item.year}
                        {item.score ? ` · ★ ${item.score}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {item.matchedFrom.map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/45 ring-1 ring-white/8"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  {item.overview && (
                    <p className="mt-2 text-xs text-white/35 line-clamp-2 leading-relaxed">
                      {item.overview}
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t border-white/8 px-4 pb-4 sm:px-5 sm:pb-5 pt-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-white/50">
                    资源与链接
                    {item.watchCount > 0 && (
                      <span className="ml-1 text-emerald-400/80">
                        · {item.watchCount} 个正版平台
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => void copyBundle(item)}
                    className="text-xs text-violet-300 hover:text-violet-200 shrink-0"
                  >
                    {copiedKey === item.key ? "已复制" : "复制全部链接"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.links.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`rounded-lg px-3 py-1.5 text-xs ring-1 transition-colors hover:brightness-110 ${linkStyle(link.kind)}`}
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && results.length === 0 && keyword && !error && (
        <p className="text-center text-sm text-white/40 py-10">未找到相关影视，请换关键词重试</p>
      )}

      <p className="text-center text-[11px] text-white/25 leading-relaxed">
        链接包含豆瓣条目、TMDB 正版观看指引与各平台搜索入口，仅供信息检索。请支持正版内容。
      </p>
    </div>
  );
}
