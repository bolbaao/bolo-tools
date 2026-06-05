"use client";

import ActionButton from "@/components/ActionButton";
import { useAgentPrefill } from "@/hooks/useAgentPrefill";
import { ApiError, apiGet, apiNotFoundMessage, apiPost } from "@/lib/api";
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

type HotTopic = {
  title: string;
  heat: string;
  tag: string;
  searchQuery: string;
};

function formatHotUpdatedAt(iso?: string) {
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

export default function AiSearchPanel() {
  const [query, setQuery] = useState("");
  const [depth, setDepth] = useState<"basic" | "advanced">("advanced");
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [hotTopics, setHotTopics] = useState<HotTopic[]>([]);
  const [hotLoading, setHotLoading] = useState(true);
  const [hotUpdatedAt, setHotUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [serviceOnline, setServiceOnline] = useState<boolean | null>(null);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);

  const searchReady = serviceOnline === true && (caps?.available ?? false);

  const runSearch = useCallback(async (q?: string, opts?: { topic?: "news" | "general" }) => {
    const term = (q ?? query).trim();
    if (!term) return;
    if (!searchReady) {
      setError(
        serviceOnline === false
          ? apiNotFoundMessage()
          : caps && !caps.available
            ? AI_SERVICE_UNAVAILABLE
            : "搜索服务尚未就绪，请稍候",
      );
      return;
    }
    setQuery(term);
    setLoading(true);
    setError(null);
    setData(null);
    setSourcesExpanded(false);
    try {
      const result = await apiPost<SearchResponse>(
        "/api/ai-search/search",
        {
          query: term,
          depth,
          synthesize: true,
          topic: opts?.topic || "general",
        },
        { timeoutMs: 120000 },
      );
      setData(result);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "搜索失败";
      setError(msg);
      if (e instanceof ApiError && e.status === 0) {
        setServiceOnline(false);
      }
    } finally {
      setLoading(false);
    }
  }, [caps, query, depth, searchReady, serviceOnline]);

  useAgentPrefill("ai-search", {
    apply: (fields) => {
      if (fields.query) setQuery(fields.query);
    },
    canSubmit: (fields) => Boolean(fields.query?.trim()),
    submit: (fields) => runSearch(fields.query),
  });

  useEffect(() => {
    apiGet<Capabilities>("/api/ai-search/capabilities", { timeoutMs: 15000 })
      .then((data) => {
        setCaps(data);
        setServiceOnline(true);
      })
      .catch(() => {
        setCaps(null);
        setServiceOnline(false);
      });
  }, []);

  const loadHotTopics = useCallback(() => {
    setHotLoading(true);
    apiGet<{ ok: boolean; topics: HotTopic[]; updatedAt?: string }>("/api/ai-search/hot-topics")
      .then((res) => {
        setHotTopics(res.topics || []);
        setHotUpdatedAt(res.updatedAt || null);
      })
      .catch(() => {
        setHotTopics([]);
        setHotUpdatedAt(null);
      })
      .finally(() => setHotLoading(false));
  }, []);

  useEffect(() => {
    loadHotTopics();
  }, [loadHotTopics]);

  return (
    <>
      {serviceOnline === false ? (
        <p className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs leading-relaxed text-red-200/90">
          {apiNotFoundMessage()} 请确认已在项目目录运行 <code className="text-red-100/90">./start.sh</code>，并访问{" "}
          <code className="text-red-100/90">http://127.0.0.1:3000</code>。
        </p>
      ) : null}

      {serviceOnline === true && caps && !caps.available ? (
        <p className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-xs leading-relaxed text-cyan-100/85">
          {AI_SERVICE_UNAVAILABLE}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          data-tool-primary-input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && query.trim() && !loading) {
              e.preventDefault();
              void runSearch();
            }
          }}
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

      <ActionButton
        label="开始搜索"
        loadingLabel="正在检索全网…"
        loading={loading}
        disabled={!query.trim() || !searchReady}
        onClick={() => runSearch()}
      />

      <section className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-medium text-white/50">当下时事热点</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/30">
              {hotLoading
                ? "正在抓取热搜…"
                : hotTopics.length > 0
                  ? `抖音热搜 · ${hotUpdatedAt ? `更新于 ${formatHotUpdatedAt(hotUpdatedAt)}` : "实时"}`
                  : "暂无热点数据"}
            </span>
            <button
              type="button"
              onClick={loadHotTopics}
              disabled={hotLoading || loading}
              className="text-[10px] text-violet-300/80 hover:text-violet-200 disabled:opacity-40"
            >
              刷新
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {hotLoading && hotTopics.length === 0 && (
            <span className="rounded-full bg-white/[0.04] px-3 py-1.5 text-xs text-white/30 ring-1 ring-white/10">
              加载热点中…
            </span>
          )}
          {hotTopics.map((item) => (
            <button
              key={item.title}
              type="button"
              onClick={() => runSearch(item.searchQuery, { topic: "news" })}
              disabled={loading || !searchReady}
              title={
                !searchReady
                  ? serviceOnline === false
                    ? apiNotFoundMessage()
                    : AI_SERVICE_UNAVAILABLE
                  : `${item.heat} · ${item.tag}`
              }
              className="rounded-full bg-amber-500/[0.08] px-3 py-1.5 text-xs text-amber-100/75 ring-1 ring-amber-500/20 hover:bg-amber-500/[0.14] hover:text-amber-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {item.title}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300/90">
          {error}
        </p>
      )}

      {data ? (
        <div className="space-y-5" data-tool-result>
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
            <section className="rounded-xl border border-white/[0.08] bg-black/20 overflow-hidden">
              <button
                type="button"
                onClick={() => setSourcesExpanded((v) => !v)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
              >
                <h3 className="text-sm font-medium text-white/55">
                  来源链接
                  <span className="ml-2 text-[11px] font-normal text-white/30">
                    {data.results.length} 条
                  </span>
                </h3>
                <span className="shrink-0 text-xs text-white/40">
                  {sourcesExpanded ? "收起 △" : "展开 ▽"}
                </span>
              </button>
              {sourcesExpanded && (
                <ul className="space-y-3 border-t border-white/[0.06] p-4 pt-3">
                  {data.results.map((item, i) => (
                    <li
                      key={`${item.url}-${i}`}
                      id={`source-${i + 1}`}
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
              )}
            </section>
          )}
        </div>
      ) : null}

      <details className="rounded-2xl border border-violet-500/15 bg-violet-500/5 px-5 py-3">
        <summary className="cursor-pointer text-sm text-white/65 marker:content-none [&::-webkit-details-marker]:hidden">
          功能说明
        </summary>
        <p className="mt-2 text-sm leading-relaxed text-white/65">
          输入问题后将检索全网并由 AI 综合多来源生成带引用的答案。下方热点来自抖音热搜，点击即可深度检索近期新闻。
        </p>
      </details>

      <p className="text-center text-xs leading-relaxed text-white/25">
        检索由 Tavily / Serper 提供 · 摘要由 DeepSeek 生成 · 请核对来源后用于重要决策
      </p>
    </>
  );
}
