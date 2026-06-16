import { env } from "./env.mjs";
import { fetchWithProxyFallback } from "./fetch-helper.mjs";
import { HttpError } from "./http-error.mjs";

function formatSearchFetchError(provider, err) {
  const msg = String(err?.message || err || "fetch failed");
  const cause = String(err?.cause?.message || err?.cause?.code || "");
  const hasProxy = Boolean(env("HTTPS_PROXY") || env("HTTP_PROXY"));
  if (hasProxy && /ECONNREFUSED|connect ECONNREFUSED|proxy/i.test(`${msg} ${cause}`)) {
    return `无法连接 ${provider}：网络代理未响应。请启动代理软件后重试，或关闭代理设置后重启应用`;
  }
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|network/i.test(`${msg} ${cause}`)) {
    const proxyHint = hasProxy
      ? "。请确认代理软件已启动"
      : "。若网络受限，可在应用配置中启用代理后重启";
    return `无法连接 ${provider}，请检查网络${proxyHint}`;
  }
  return `无法连接 ${provider}，请稍后再试`;
}

/** Tavily country 需完整英文名（如 china），不能传 cn/us 等缩写 */
const TAVILY_COUNTRY_ALIASES = {
  cn: "china",
  us: "united states",
  usa: "united states",
  jp: "japan",
  kr: "south korea",
  gb: "united kingdom",
  uk: "united kingdom",
  tw: "taiwan",
};

function normalizeTavilyCountry(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return undefined;
  if (TAVILY_COUNTRY_ALIASES[raw]) return TAVILY_COUNTRY_ALIASES[raw];
  return raw;
}

/**
 * @typedef {{ title: string, url: string, snippet: string, score?: number }} WebSearchResult
 */

export function getWebSearchCapabilities() {
  return {
    tavily: Boolean(env("TAVILY_API_KEY")),
    serper: Boolean(env("SERPER_API_KEY")),
    imageSearch: Boolean(env("SERPER_API_KEY") || env("TAVILY_API_KEY")),
    available: Boolean(env("TAVILY_API_KEY") || env("SERPER_API_KEY")),
  };
}

/**
 * @param {string} query
 * @param {{ depth?: 'basic'|'advanced', maxResults?: number, topic?: 'general'|'news', days?: number, region?: { gl?: string, hl?: string, tavilyCountry?: string }, includeRawContent?: boolean }} opts
 * @returns {Promise<{ query: string, provider: string, answer?: string, results: WebSearchResult[] }>}
 */
export async function searchWeb(query, opts = {}) {
  const q = String(query || "").trim();
  if (!q) throw new HttpError(400, "请输入搜索内容");

  const depth = opts.depth === "basic" ? "basic" : "advanced";
  const maxResults = Math.min(12, Math.max(3, Number(opts.maxResults) || 8));
  const topic = opts.topic === "news" ? "news" : "general";
  const days = Math.min(30, Math.max(1, Number(opts.days) || (topic === "news" ? 3 : 0))) || undefined;
  const region = opts.region || null;

  if (env("TAVILY_API_KEY")) {
    return searchWithTavily(q, { depth, maxResults, topic, days, region, includeRawContent: opts.includeRawContent });
  }
  if (env("SERPER_API_KEY")) {
    return searchWithSerper(q, { maxResults, topic, region });
  }

  throw new HttpError(
    503,
    "未配置全网搜索。请在 .env 设置 TAVILY_API_KEY（推荐，https://tavily.com）或 SERPER_API_KEY（https://serper.dev）",
  );
}

async function searchWithTavily(query, { depth, maxResults, topic, days, region, includeRawContent }) {
  const apiKey = env("TAVILY_API_KEY");
  const body = {
    api_key: apiKey,
    query,
    search_depth: depth,
    topic,
    include_answer: true,
    include_raw_content: includeRawContent === true,
    max_results: maxResults,
  };
  if (topic === "news" && days) {
    body.days = days;
  }
  if (topic === "general" && region?.tavilyCountry) {
    const country = normalizeTavilyCountry(region.tavilyCountry);
    if (country) body.country = country;
  }

  let data;
  try {
    const res = await fetchWithProxyFallback("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.detail?.error || data?.error || `Tavily 错误（${res.status}）`;
      throw new HttpError(res.status >= 500 ? 502 : 422, String(msg).slice(0, 240));
    }
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, formatSearchFetchError("Tavily", e));
  }

  const snippetLimit = includeRawContent ? 1200 : 600;
  const results = (data.results || []).map((r) => ({
    title: String(r.title || "").trim() || "未命名页面",
    url: String(r.url || "").trim(),
    snippet: String(r.raw_content || r.content || r.snippet || "").trim().slice(0, snippetLimit),
    score: typeof r.score === "number" ? r.score : undefined,
  })).filter((r) => r.url);

  return {
    query,
    provider: "tavily",
    answer: typeof data.answer === "string" ? data.answer.trim() : undefined,
    results,
  };
}

async function searchWithSerper(query, { maxResults, topic, region }) {
  const apiKey = env("SERPER_API_KEY");
  const endpoint = topic === "news" ? "https://google.serper.dev/news" : "https://google.serper.dev/search";
  let data;
  try {
    const res = await fetchWithProxyFallback(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        q: query,
        num: maxResults,
        gl: region?.gl || "cn",
        hl: region?.hl || "zh-cn",
      }),
    });
    data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new HttpError(res.status >= 500 ? 502 : 422, data?.message || `Serper 错误（${res.status}）`);
    }
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, formatSearchFetchError("Serper", e));
  }

  const organic = topic === "news" ? data.news || [] : data.organic || [];
  const results = organic.map((r) => ({
    title: String(r.title || "").trim() || "未命名页面",
    url: String(r.link || "").trim(),
    snippet: String(r.snippet || "").trim().slice(0, 600),
    score: undefined,
  })).filter((r) => r.url);

  const answer =
    typeof data.answerBox?.answer === "string"
      ? data.answerBox.answer
      : typeof data.knowledgeGraph?.description === "string"
        ? data.knowledgeGraph.description
        : undefined;

  return {
    query,
    provider: "serper",
    answer,
    results,
  };
}
