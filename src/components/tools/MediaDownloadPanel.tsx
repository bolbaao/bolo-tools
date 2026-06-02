"use client";

import ActionButton from "@/components/ActionButton";
import { useAgentPrefill } from "@/hooks/useAgentPrefill";
import { ApiError, apiGet } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

type ParsedLink = {
  platform: string;
  label: string;
  url: string;
  password?: string;
};

type ResourceItem = {
  id: string;
  title: string;
  content: string;
  links: ParsedLink[];
  poster: string | null;
};

type ResourceSection = {
  source: string;
  sourceId: string;
  items: ResourceItem[];
};

type ResourceSearchResponse = {
  ok: boolean;
  query: string;
  sections: ResourceSection[];
  stats: { sections: number; items: number; links: number };
  copyText: string;
  errors?: string[];
};

const PLATFORM_STYLE: Record<string, string> = {
  baidu: "text-blue-300/90 ring-blue-500/25 bg-blue-500/10",
  xunlei: "text-cyan-300/90 ring-cyan-500/25 bg-cyan-500/10",
  quark: "text-violet-300/90 ring-violet-500/25 bg-violet-500/10",
  alipan: "text-orange-300/90 ring-orange-500/25 bg-orange-500/10",
  uc: "text-emerald-300/90 ring-emerald-500/25 bg-emerald-500/10",
};

export default function MediaDownloadPanel() {
  const [keyword, setKeyword] = useState("");
  const [sections, setSections] = useState<ResourceSection[]>([]);
  const [stats, setStats] = useState<ResourceSearchResponse["stats"] | null>(null);
  const [copyText, setCopyText] = useState("");
  const [hotKeywords, setHotKeywords] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const runSearch = useCallback(async (q: string) => {
    const term = q.trim();
    if (!term) return;
    setLoading(true);
    setError(null);
    setWarnings([]);
    setKeyword(term);
    try {
      const params = new URLSearchParams({ q: term });
      const data = await apiGet<ResourceSearchResponse>(`/api/media/resource-search?${params}`);
      setSections(data.sections);
      setStats(data.stats);
      setCopyText(data.copyText);
      setWarnings(data.errors || []);
      setCollapsed({});
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "搜索失败");
      setSections([]);
      setStats(null);
      setCopyText("");
    } finally {
      setLoading(false);
    }
  }, []);

  useAgentPrefill("media-download", {
    apply: (fields) => {
      if (fields.keyword) setKeyword(fields.keyword);
    },
    canSubmit: (fields) => Boolean(fields.keyword?.trim()),
    submit: (fields) => runSearch(fields.keyword),
  });

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

  const copyTextBundle = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 2000);
  };

  const linkStyle = (platform: string) =>
    PLATFORM_STYLE[platform] || "text-white/55 ring-white/10 bg-white/5";

  const toggleSection = (sourceId: string) => {
    setCollapsed((prev) => ({ ...prev, [sourceId]: !prev[sourceId] }));
  };

  const hasResults = sections.some((s) => s.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 px-5 py-4">
        <p className="text-sm text-white/65 leading-relaxed">
          输入片名后，将<strong className="text-white/85 font-medium">智能检索</strong>
          网盘资源，聚合百度网盘、迅雷、夸克、阿里云盘等下载链接，支持一键复制。
        </p>
        <p className="mt-2 text-xs text-white/35">
          提示：不要带「第几部」「第几期」等无关词；搜不到时可换关键词或刷新重试。
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void runSearch(keyword)}
          placeholder="输入影视名称…"
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
        />
        <ActionButton
          label="搜索资源"
          loadingLabel="检索中…"
          loading={loading}
          disabled={!keyword.trim()}
          onClick={() => void runSearch(keyword)}
          className="!from-amber-600 !to-orange-700 sm:min-w-[120px]"
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
              className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/50 ring-1 ring-white/8 hover:bg-amber-500/15 hover:text-amber-200/90 disabled:opacity-40"
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

      {warnings.length > 0 && !error && (
        <p className="text-xs text-amber-300/70 text-center rounded-xl bg-amber-500/10 px-4 py-2">
          部分来源暂未返回结果：{warnings.join("；")}
        </p>
      )}

      {stats && !loading && (
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-white/35">
          <span>
            {stats.sections} 个来源 · {stats.items} 条结果 · {stats.links} 个链接
          </span>
          {copyText && (
            <button
              type="button"
              onClick={() => void copyTextBundle(copyText, "all")}
              className="text-amber-300 hover:text-amber-200"
            >
              {copiedKey === "all" ? "已复制全部" : "复制全部结果"}
            </button>
          )}
        </div>
      )}

      {loading && (
        <p className="text-center text-sm text-white/40 py-10">正在检索网盘资源…</p>
      )}

      {!loading && hasResults && (
        <div className="space-y-4">
          {sections.map((section) => (
            <section
              key={section.sourceId}
              className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleSection(section.sourceId)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-5 text-left hover:bg-white/[0.02]"
              >
                <div>
                  <h3 className="text-sm font-semibold text-white/85">{section.source}</h3>
                  <p className="text-xs text-white/35 mt-0.5">{section.items.length} 条结果</p>
                </div>
                <span className="text-xs text-white/40 shrink-0">
                  {collapsed[section.sourceId] ? "展开 ▽" : "收起 △"}
                </span>
              </button>

              {!collapsed[section.sourceId] && (
                <ul className="border-t border-white/8 divide-y divide-white/6">
                  {section.items.map((item) => (
                    <li key={item.id} className="p-4 sm:p-5">
                      <div className="flex gap-4">
                        {item.poster ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.poster}
                            alt=""
                            className="w-14 h-20 object-cover rounded-lg shrink-0 bg-white/5 hidden sm:block"
                          />
                        ) : null}
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <h4 className="text-sm font-medium text-white/90 leading-snug">
                              {item.title}
                            </h4>
                            <button
                              type="button"
                              onClick={() =>
                                void copyTextBundle(
                                  [item.title, item.content].filter(Boolean).join("\n"),
                                  item.id,
                                )
                              }
                              className="text-xs text-amber-300/90 hover:text-amber-200 shrink-0"
                            >
                              {copiedKey === item.id ? "已复制" : "复制"}
                            </button>
                          </div>

                          {item.links.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {item.links.map((link) => (
                                <a
                                  key={link.url}
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`rounded-lg px-3 py-1.5 text-xs ring-1 transition-colors hover:brightness-110 ${linkStyle(link.platform)}`}
                                >
                                  {link.label}
                                  {link.password ? ` · ${link.password}` : ""}
                                </a>
                              ))}
                            </div>
                          ) : null}

                          {item.content && (
                            <pre className="text-xs text-white/40 whitespace-pre-wrap break-all leading-relaxed font-sans">
                              {item.content}
                            </pre>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      {!loading && !hasResults && keyword && !error && (
        <p className="text-center text-sm text-white/40 py-10">
          未找到相关资源，请换关键词重试（不要带第几部、第几期等无关词）
        </p>
      )}

      <p className="text-center text-[11px] text-white/25 leading-relaxed">
        本工具来自公开内容检索，搜索结果不代表本站立场。请支持正版内容，链接仅供信息检索。
      </p>
    </div>
  );
}
