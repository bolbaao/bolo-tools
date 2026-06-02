"use client";

import ActionButton from "@/components/ActionButton";
import { useAgentPrefill } from "@/hooks/useAgentPrefill";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import { AI_SERVICE_UNAVAILABLE } from "@/lib/service-message";
import { useCallback, useEffect, useState } from "react";

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  score?: number;
};

type SearchResponse = {
  ok: boolean;
  query: string;
  provider: string;
  summary: string | null;
  synthesized: boolean;
  results: SearchResult[];
};

type Capabilities = {
  ok: boolean;
  tavily: boolean;
  serper: boolean;
  available: boolean;
  aiSynthesis: boolean;
};

const EXAMPLE_QUERIES = [
  "2025 年新能源汽车销量趋势",
  "Cursor IDE 最新功能",
  "如何优化 Next.js 首屏加载",
  "苹果 Vision Pro 国内发售",
];

export default function AiSearchPanel() {
  const [query, setQuery] = useState("");
  const [depth, setDepth] = useState<"basic" | "advanced">("advanced");
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SearchResponse | null>(null);

  const applyPrefill = useCallback((fields: Record<string, string>) => {
    if (fields.query) setQuery(fields.query);
  }, []);
  useAgentPrefill("ai-search", applyPrefill);

  useEffect(() => {
    apiGet<Capabilities>("/api/ai-search/capabilities")
      .then(setCaps)
      .catch(() => setCaps(null));
  }, []);

  const runSearch = async (q?: string) => {
    const term = (q ?? query).trim();
    if (!term) return;
    setQuery(term);
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const result = await apiPost<SearchResponse>(
        "/api/ai-search/search",
        { query: term, depth, synthesize: true },
        { timeoutMs: 120000 },
      );
      setData(result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "搜索失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-violet-500/15 bg-violet-500/5 px-5 py-4">
        <p className="text-sm text-white/65 leading-relaxed">
          输入问题后，将<strong className="text-white/85 font-medium">检索全网</strong>
          并由 AI 综合多来源生成带引用的答案，适合查资料、对比信息、快速了解热点。
        </p>
      </div>

      {caps && !caps.available && (
        <p className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-xs leading-relaxed text-cyan-100/85">
          {AI_SERVICE_UNAVAILABLE}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          placeholder="输入你想查的问题…"
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-violet-500/40 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
        />
        <select
          value={depth}
          onChange={(e) => setDepth(e.target.value as "basic" | "advanced")}
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white focus:outline-none focus:border-violet-500/40"
          title="检索深度"
        >
          <option value="advanced">深度检索</option>
          <option value="basic">快速检索</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        {EXAMPLE_QUERIES.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => runSearch(q)}
            disabled={loading}
            className="rounded-full bg-white/[0.04] px-3 py-1.5 text-xs text-white/45 ring-1 ring-white/10 hover:bg-white/[0.08] hover:text-white/70 disabled:opacity-40"
          >
            {q}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300/90">
          {error}
        </p>
      )}

      {data && (
        <div className="space-y-5">
          {data.summary && (
            <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <h3 className="text-sm font-medium text-white/80">AI 综合回答</h3>
                {data.synthesized && (
                  <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] text-violet-200/90 ring-1 ring-violet-500/25">
                    DeepSeek 整理
                  </span>
                )}
                <span className="text-[10px] text-white/30">
                  {data.results.length} 条来源
                </span>
              </div>
              <div className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap">{data.summary}</div>
            </section>
          )}

          {data.results.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-white/55">来源链接</h3>
              <ul className="space-y-3">
                {data.results.map((item, i) => (
                  <li
                    key={`${item.url}-${i}`}
                    className="rounded-xl border border-white/[0.08] bg-black/20 p-4 hover:border-violet-500/20 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-md bg-violet-500/15 text-[10px] font-medium text-violet-200/90">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-violet-200/95 hover:text-violet-100 line-clamp-2"
                        >
                          {item.title}
                        </a>
                        <p className="mt-1 text-[11px] text-white/30 truncate">{item.url}</p>
                        {item.snippet && (
                          <p className="mt-2 text-xs text-white/50 leading-relaxed line-clamp-3">
                            {item.snippet}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <ActionButton
        label="开始搜索"
        loadingLabel="正在检索全网…"
        loading={loading}
        disabled={!query.trim() || (caps ? !caps.available : false)}
        onClick={() => runSearch()}
      />

      <p className="text-center text-xs text-white/25 leading-relaxed">
        检索由 Tavily / Serper 提供 · 摘要由 DeepSeek 生成 · 请核对来源后用于重要决策
      </p>
    </div>
  );
}
