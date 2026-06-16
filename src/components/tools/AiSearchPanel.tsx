"use client";

import { useAgentPrefill } from "@/hooks/useAgentPrefill";
import { ApiError, apiGet, apiNotFoundMessage, apiPost } from "@/lib/api";
import { AI_SERVICE_UNAVAILABLE } from "@/lib/service-message";
import { useCallback, useEffect, useRef, useState } from "react";

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  score?: number;
  platform?: string;
  platformLabel?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  duration?: string;
  channel?: string;
};

type SearchResponse = {
  ok: boolean;
  query: string;
  searchQuery?: string;
  understanding?: string | null;
  mode?: SearchMode;
  modeLabel?: string;
  provider: string;
  summary: string | null;
  synthesized: boolean;
  results: SearchResult[];
  forceChinese?: boolean;
};

const PREFER_CHINESE_KEY = "ai-search-prefer-chinese";

function readPreferChinese() {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(PREFER_CHINESE_KEY) !== "0";
}

function resolveForceChinese(mode: SearchMode, preferChinese: boolean) {
  if (mode === "multilingual") return false;
  return preferChinese;
}

type Capabilities = {
  ok: boolean;
  tavily: boolean;
  serper: boolean;
  available: boolean;
  imageSearch?: boolean;
  videoSearch?: boolean;
  aiSynthesis: boolean;
};

function isModeReady(mode: SearchMode, caps: Capabilities | null) {
  if (!caps) return false;
  if (mode === "images") return Boolean(caps.imageSearch ?? caps.available);
  if (mode === "videos") return Boolean(caps.videoSearch ?? caps.available);
  return caps.available;
}

function modeUnavailableMessage(mode: SearchMode) {
  if (mode === "images") return "图片搜索暂不可用，请稍后再试。如需开通请联系客服。";
  if (mode === "videos") return "视频搜索暂不可用，请稍后再试。如需开通请联系客服。";
  return AI_SERVICE_UNAVAILABLE;
}

function showsLanguagePrefs(mode: SearchMode) {
  return mode !== "media" && mode !== "images" && mode !== "videos";
}

function searchPlaceholder(mode: SearchMode) {
  if (mode === "images") return "描述你想找的图片，如：西湖日落、咖啡店门头…";
  if (mode === "videos") return "输入视频主题或片名，如：达芬奇调色教程、流浪地球…";
  if (mode === "media") return "输入关键词，在抖音、小红书、公众号中检索…";
  return "输入你想查询的问题…";
}

type HotTopic = {
  title: string;
  heat: string;
  tag: string;
};

type SearchMode = "quick" | "deep" | "academic" | "news" | "multilingual" | "media" | "web" | "images" | "videos";

type MediaPlatformId = "douyin" | "xiaohongshu" | "wechat";

const MEDIA_PLATFORMS: { id: MediaPlatformId; label: string; icon: string; href: string }[] = [
  { id: "douyin", label: "抖音", icon: "🎵", href: "https://www.douyin.com/" },
  { id: "xiaohongshu", label: "小红书", icon: "📕", href: "https://www.xiaohongshu.com/" },
  { id: "wechat", label: "微信公众号", icon: "💬", href: "https://mp.weixin.qq.com/" },
];

const EXPLORE_MODES: {
  id: SearchMode;
  title: string;
  desc: string;
  tone: string;
  icon: string;
}[] = [
  {
    id: "quick",
    title: "快速搜索",
    desc: "快速获取简要答案，节省时间",
    tone: "sky",
    icon: "⏱",
  },
  {
    id: "deep",
    title: "深度搜索",
    desc: "全面深入分析，提供详细信息",
    tone: "emerald",
    icon: "🔍",
  },
  {
    id: "academic",
    title: "学术搜索",
    desc: "专注学术资源，查找论文文献",
    tone: "violet",
    icon: "🎓",
  },
  {
    id: "news",
    title: "新闻搜索",
    desc: "获取最新新闻，追踪热点事件",
    tone: "amber",
    icon: "📰",
  },
  {
    id: "multilingual",
    title: "多语言搜索",
    desc: "支持多语言搜索，打破语言壁垒",
    tone: "blue",
    icon: "🌐",
  },
  {
    id: "media",
    title: "媒体搜索",
    desc: "在抖音、小红书、微信公众号中检索",
    tone: "rose",
    icon: "📱",
  },
  {
    id: "web",
    title: "网页搜索",
    desc: "检索全网网页、博客与文档，附来源链接",
    tone: "indigo",
    icon: "🌐",
  },
  {
    id: "images",
    title: "图片搜索",
    desc: "全网检索图片，覆盖主流平台与网页配图",
    tone: "fuchsia",
    icon: "🖼",
  },
  {
    id: "videos",
    title: "视频搜索",
    desc: "检索 B 站、抖音、YouTube 等全网视频",
    tone: "orange",
    icon: "🎬",
  },
];

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

function hotTagClass(tag: string) {
  if (tag === "新") return "ai-search-hot-tag ai-search-hot-tag--new";
  if (tag === "热") return "ai-search-hot-tag ai-search-hot-tag--hot";
  if (tag === "荐") return "ai-search-hot-tag ai-search-hot-tag--rec";
  return "ai-search-hot-tag";
}

function getModeMeta(mode: SearchMode) {
  return EXPLORE_MODES.find((item) => item.id === mode) ?? EXPLORE_MODES[1];
}

export default function AiSearchPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchSeqRef = useRef(0);
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("deep");
  const [preferChinese, setPreferChinese] = useState(true);
  const [mediaPlatforms, setMediaPlatforms] = useState<MediaPlatformId[]>([
    "douyin",
    "xiaohongshu",
    "wechat",
  ]);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [hotTopics, setHotTopics] = useState<HotTopic[]>([]);
  const [hotLoading, setHotLoading] = useState(true);
  const [hotUpdatedAt, setHotUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [serviceOnline, setServiceOnline] = useState<boolean | null>(null);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [showLanding, setShowLanding] = useState(true);

  const searchReady = serviceOnline === true && isModeReady(searchMode, caps);

  const cancelSearch = useCallback(() => {
    searchAbortRef.current?.abort();
    searchAbortRef.current = null;
  }, []);

  const runSearch = useCallback(
    async (
      q?: string,
      opts?: {
        mode?: SearchMode;
        forceChinese?: boolean;
        mediaPlatforms?: MediaPlatformId[];
      },
    ) => {
      const term = (q ?? query).trim();
      if (!term) return;
      if (!searchReady) {
        const mode = opts?.mode ?? searchMode;
        setError(
          serviceOnline === false
            ? apiNotFoundMessage()
            : caps && !isModeReady(mode, caps)
              ? modeUnavailableMessage(mode)
              : "搜索服务尚未就绪，请稍候",
        );
        return;
      }

      const mode = opts?.mode ?? searchMode;
      const platforms = opts?.mediaPlatforms ?? mediaPlatforms;
      const forceChinese = opts?.forceChinese ?? resolveForceChinese(mode, preferChinese);
      const seq = ++searchSeqRef.current;

      cancelSearch();
      const controller = new AbortController();
      searchAbortRef.current = controller;

      setQuery(term);
      setSearchMode(mode);
      setLoading(true);
      setError(null);
      setData(null);
      setSourcesExpanded(false);
      setShowLanding(false);

      try {
        const result = await apiPost<SearchResponse>(
          "/api/ai-search/search",
          {
            query: term,
            mode,
            synthesize: mode !== "images" && mode !== "videos",
            forceChinese,
            mediaPlatforms: mode === "media" ? platforms : undefined,
          },
          { timeoutMs: 120000, signal: controller.signal },
        );
        if (seq !== searchSeqRef.current || controller.signal.aborted) return;
        setData(result);
        if (result.mode) setSearchMode(result.mode);
        setSourcesExpanded(
          result.mode === "media" ||
            result.mode === "web" ||
            result.mode === "images" ||
            result.mode === "videos" ||
            result.results.length <= 5,
        );
      } catch (e) {
        if (controller.signal.aborted || seq !== searchSeqRef.current) return;
        const msg = e instanceof ApiError ? e.message : "搜索失败";
        setError(msg);
        if (e instanceof ApiError && e.status === 0) {
          setServiceOnline(false);
        }
      } finally {
        if (seq === searchSeqRef.current) {
          setLoading(false);
          if (searchAbortRef.current === controller) {
            searchAbortRef.current = null;
          }
        }
      }
    },
    [cancelSearch, caps, preferChinese, query, searchMode, searchReady, serviceOnline, mediaPlatforms],
  );

  const handlePreferChineseChange = useCallback(
    (next: boolean) => {
      setPreferChinese(next);
      if (typeof window !== "undefined") {
        localStorage.setItem(PREFER_CHINESE_KEY, next ? "1" : "0");
      }
      const term = query.trim();
      if (term && searchReady && showsLanguagePrefs(searchMode)) {
        void runSearch(term, { forceChinese: resolveForceChinese(searchMode, next) });
      }
    },
    [query, runSearch, searchMode, searchReady],
  );

  const handleModeChange = useCallback(
    (mode: SearchMode) => {
      if (mode === searchMode && !loading) return;

      cancelSearch();
      searchSeqRef.current += 1;
      setSearchMode(mode);
      setError(null);

      const term = query.trim();
      if (term && searchReady) {
        void runSearch(term, {
          mode,
          forceChinese: resolveForceChinese(mode, preferChinese),
        });
        return;
      }

      setLoading(false);
      if (data) {
        setData(null);
        setShowLanding(true);
      }
    },
    [cancelSearch, data, loading, preferChinese, query, runSearch, searchMode, searchReady],
  );

  useAgentPrefill("ai-search", {
    apply: (fields) => {
      if (fields.query) setQuery(fields.query);
    },
    canSubmit: (fields) => Boolean(fields.query?.trim()),
    submit: (fields) => runSearch(fields.query),
  });

  useEffect(() => {
    setPreferChinese(readPreferChinese());
  }, []);

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

  const toggleMediaPlatform = (id: MediaPlatformId) => {
    setMediaPlatforms((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      return next.length ? next : [id];
    });
  };

  const handleExploreClick = (mode: SearchMode) => {
    handleModeChange(mode);
    inputRef.current?.focus();
  };

  const activeMode = getModeMeta(searchMode);

  return (
    <div className="ai-search-panel">
      {serviceOnline === false ? (
        <p className="ai-search-alert ai-search-alert--error">
          {apiNotFoundMessage()} 请确认已在项目目录运行 <code>./start.sh</code>，并访问{" "}
          <code>http://127.0.0.1:3000</code>。
        </p>
      ) : null}

      {serviceOnline === true && caps && !isModeReady(searchMode, caps) ? (
        <p className="ai-search-alert ai-search-alert--warn">{modeUnavailableMessage(searchMode)}</p>
      ) : null}

      <section className="ai-search-hero-block">
        <div className="ai-search-mode-bar">
          <span className="ai-search-mode-bar-label">当前模式</span>
          <div className="ai-search-mode-select">
            <span className={`ai-search-mode-chip ai-search-mode-chip--${activeMode.tone}`}>
              <span aria-hidden>{activeMode.icon}</span>
              {activeMode.title}
            </span>
            <select
              value={searchMode}
              onChange={(e) => handleModeChange(e.target.value as SearchMode)}
              className="ai-search-mode-native"
              aria-label="搜索模式"
            >
              {EXPLORE_MODES.map((mode) => (
                <option key={mode.id} value={mode.id}>
                  {mode.title}
                </option>
              ))}
            </select>
            <svg className="ai-search-mode-chevron" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <span className="ai-search-mode-desc">{activeMode.desc}</span>
        </div>

        {showsLanguagePrefs(searchMode) ? (
          <div className="ai-search-language-prefs">
            <span className="ai-search-language-prefs-label">结果语言</span>
            <div className="ai-search-language-prefs-row">
              <button
                type="button"
                onClick={() => handlePreferChineseChange(true)}
                disabled={searchMode === "multilingual" || loading}
                className={`ai-search-language-chip${
                  resolveForceChinese(searchMode, preferChinese)
                    ? " ai-search-language-chip--active"
                    : ""
                }`}
              >
                优先中文网页
              </button>
              <button
                type="button"
                onClick={() => handlePreferChineseChange(false)}
                disabled={searchMode === "multilingual" || loading}
                className={`ai-search-language-chip${
                  !resolveForceChinese(searchMode, preferChinese)
                    ? " ai-search-language-chip--active"
                    : ""
                }`}
              >
                不限语言
              </button>
            </div>
            {searchMode === "multilingual" ? (
              <span className="ai-search-language-prefs-hint">多语言模式默认不限语言</span>
            ) : null}
          </div>
        ) : null}

        {searchMode === "media" ? (
          <div className="ai-search-media-platforms">
            <span className="ai-search-media-platforms-label">搜索范围</span>
            <div className="ai-search-media-platforms-row">
              {MEDIA_PLATFORMS.map((p) => (
                <div key={p.id} className="ai-search-media-chip-wrap">
                  <button
                    type="button"
                    onClick={() => toggleMediaPlatform(p.id)}
                    className={`ai-search-media-chip${
                      mediaPlatforms.includes(p.id) ? " ai-search-media-chip--active" : ""
                    }`}
                  >
                    <span aria-hidden>{p.icon}</span>
                    {p.label}
                  </button>
                  <a
                    href={p.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ai-search-media-chip-link"
                    title={`打开${p.label}`}
                    aria-label={`打开${p.label}`}
                  >
                    ↗
                  </a>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="ai-search-input-shell">
          <input
            ref={inputRef}
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
            placeholder={searchPlaceholder(searchMode)}
            className="ai-search-input"
          />
          <div className="ai-search-input-actions">
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="ai-search-input-clear"
                aria-label="清空"
              >
                ×
              </button>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void runSearch()}
          disabled={!query.trim() || !searchReady || loading}
          className="ai-search-submit"
        >
          {loading ? (
            <span className="ai-search-submit-inner">
              <span className="ai-search-submit-spinner" aria-hidden />
              正在检索全网…
            </span>
          ) : (
            <>
              <span className="ai-search-submit-inner">
                <span className="ai-search-submit-sparkle" aria-hidden>
                  ✦
                </span>
                开始搜索
              </span>
              <span className="ai-search-submit-kbd">Enter ↵</span>
            </>
          )}
        </button>
      </section>

      {showLanding && !data ? (
        <>
          <section className="ai-search-section">
            <div className="ai-search-section-head">
              <div>
                <h2 className="ai-search-section-title">
                  <span className="ai-search-section-icon ai-search-section-icon--fire" aria-hidden>
                    🔥
                  </span>
                  实时热点
                </h2>
                <p className="ai-search-section-desc">为你精选全网最新热点</p>
              </div>
              <div className="ai-search-section-meta">
                <span>
                  {hotLoading
                    ? "正在抓取热搜…"
                    : hotTopics.length > 0
                      ? `数据更新于 ${formatHotUpdatedAt(hotUpdatedAt ?? undefined)}`
                      : "暂无热点数据"}
                </span>
                <button
                  type="button"
                  onClick={loadHotTopics}
                  disabled={hotLoading || loading}
                  className="ai-search-refresh"
                >
                  刷新 ↻
                </button>
              </div>
            </div>

            <div className="ai-search-hot-grid">
              {hotLoading && hotTopics.length === 0
                ? Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="ai-search-hot-item ai-search-hot-item--skeleton" />
                  ))
                : hotTopics.map((item, index) => (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() =>
                        runSearch(item.title, {
                          mode: "news",
                          forceChinese: resolveForceChinese("news", preferChinese),
                        })
                      }
                      disabled={loading || !searchReady}
                      title={`${item.heat}${item.tag ? ` · ${item.tag}` : ""}`}
                      className="ai-search-hot-item"
                    >
                      <span className="ai-search-hot-rank">{index + 1}.</span>
                      <span className="ai-search-hot-title">{item.title}</span>
                      {item.tag && item.tag !== "话题" ? (
                        <span className={hotTagClass(item.tag)}>{item.tag}</span>
                      ) : null}
                    </button>
                  ))}
            </div>
          </section>

          <section className="ai-search-section">
            <div className="ai-search-section-head">
              <div>
                <h2 className="ai-search-section-title">探索更多</h2>
                <p className="ai-search-section-desc">尝试不同的搜索方式，获取更精准的结果</p>
              </div>
            </div>

            <div className="ai-search-explore-grid">
              {EXPLORE_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => handleExploreClick(mode.id)}
                  disabled={loading}
                  className={`ai-search-explore-card ai-search-explore-card--${mode.tone}${searchMode === mode.id ? " ai-search-explore-card--active" : ""}`}
                >
                  <span className="ai-search-explore-icon" aria-hidden>
                    {mode.icon}
                  </span>
                  <span className="ai-search-explore-title">{mode.title}</span>
                  <span className="ai-search-explore-desc">{mode.desc}</span>
                  <span className="ai-search-explore-arrow" aria-hidden>
                    →
                  </span>
                </button>
              ))}
            </div>
          </section>
        </>
      ) : null}

      {error ? <p className="ai-search-alert ai-search-alert--error">{error}</p> : null}

      {data ? (
        <div className="ai-search-results space-y-5" data-tool-result>
          <button
            type="button"
            onClick={() => {
              cancelSearch();
              searchSeqRef.current += 1;
              setLoading(false);
              setShowLanding(true);
              setData(null);
              setError(null);
            }}
            className="ai-search-back-landing"
          >
            ← 返回搜索首页
          </button>

          {data.summary ? (
            <section className="ai-search-result-card">
              <div className="ai-search-result-head">
                <h3 className="ai-search-result-title">AI 综合回答</h3>
                {data.synthesized ? (
                  <span className="ai-search-result-badge">DeepSeek 整理</span>
                ) : null}
                <span className="ai-search-result-meta">
                  {data.results.length} 条来源
                  {data.forceChinese ? " · 已优先中文网页" : " · 不限语言"}
                </span>
              </div>
              <div className="ai-search-result-body">{data.summary}</div>
            </section>
          ) : null}

          {data.mode === "media" && data.results.length > 0 ? (
            <section className="ai-search-media-results">
              <h3 className="ai-search-result-title">社交媒体结果</h3>
              <ul className="ai-search-media-results-list">
                {data.results.map((item, i) => (
                  <li key={`${item.url}-${i}`} className="ai-search-media-result-item">
                    <div className="min-w-0 flex-1">
                      <div className="ai-search-media-result-head">
                        {item.platformLabel ? (
                          <span className="ai-search-source-platform">{item.platformLabel}</span>
                        ) : null}
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ai-search-source-link"
                        >
                          {item.title}
                        </a>
                      </div>
                      {item.snippet ? (
                        <p className="ai-search-source-snippet">{item.snippet}</p>
                      ) : null}
                    </div>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ai-search-open-link"
                    >
                      打开链接
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.mode === "images" && data.results.length > 0 ? (
            <section className="ai-search-image-results">
              <h3 className="ai-search-result-title">
                图片结果
                <span className="ai-search-result-meta">{data.results.length} 张</span>
              </h3>
              <ul className="ai-search-image-grid">
                {data.results.map((item, i) => (
                  <li key={`${item.url}-${i}`} className="ai-search-image-card">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ai-search-image-card-link"
                    >
                      {item.thumbnailUrl || item.imageUrl ? (
                        <img
                          src={item.thumbnailUrl || item.imageUrl}
                          alt={item.title}
                          className="ai-search-image-thumb"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="ai-search-image-thumb ai-search-image-thumb--placeholder">无预览</div>
                      )}
                      <div className="ai-search-image-card-body">
                        {item.platformLabel ? (
                          <span className="ai-search-source-platform">{item.platformLabel}</span>
                        ) : null}
                        <span className="ai-search-image-title">{item.title}</span>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.mode === "videos" && data.results.length > 0 ? (
            <section className="ai-search-video-results">
              <h3 className="ai-search-result-title">
                视频结果
                <span className="ai-search-result-meta">{data.results.length} 条</span>
              </h3>
              <ul className="ai-search-video-results-list">
                {data.results.map((item, i) => (
                  <li key={`${item.url}-${i}`} className="ai-search-video-result-item">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ai-search-video-thumb-wrap"
                    >
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          className="ai-search-video-thumb"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="ai-search-video-thumb ai-search-video-thumb--placeholder">▶</div>
                      )}
                      {item.duration ? (
                        <span className="ai-search-video-duration">{item.duration}</span>
                      ) : null}
                    </a>
                    <div className="min-w-0 flex-1">
                      <div className="ai-search-media-result-head">
                        {item.platformLabel ? (
                          <span className="ai-search-source-platform">{item.platformLabel}</span>
                        ) : null}
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ai-search-source-link"
                        >
                          {item.title}
                        </a>
                      </div>
                      {item.channel ? (
                        <p className="ai-search-video-channel">{item.channel}</p>
                      ) : null}
                      {item.snippet ? (
                        <p className="ai-search-source-snippet">{item.snippet}</p>
                      ) : null}
                    </div>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ai-search-open-link"
                    >
                      打开视频
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.results.length > 0 &&
          data.mode !== "media" &&
          data.mode !== "images" &&
          data.mode !== "videos" ? (
            <section className="ai-search-sources">
              <button
                type="button"
                onClick={() => setSourcesExpanded((v) => !v)}
                className="ai-search-sources-toggle"
              >
                <h3 className="ai-search-result-title">
                  {data.mode === "web" ? "网页结果" : "来源链接"}
                  <span className="ai-search-result-meta">{data.results.length} 条</span>
                </h3>
                <span className="ai-search-sources-chevron">{sourcesExpanded ? "收起 △" : "展开 ▽"}</span>
              </button>
              {sourcesExpanded ? (
                <ul className="ai-search-sources-list">
                  {data.results.map((item, i) => (
                    <li key={`${item.url}-${i}`} id={`source-${i + 1}`} className="ai-search-source-item">
                      <span className="ai-search-source-rank">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ai-search-source-link"
                        >
                          {item.platformLabel ? (
                            <span className="ai-search-source-platform">{item.platformLabel}</span>
                          ) : null}
                          {item.title}
                        </a>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ai-search-source-url"
                          title={item.url}
                        >
                          {item.url}
                        </a>
                        {item.snippet ? <p className="ai-search-source-snippet">{item.snippet}</p> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
