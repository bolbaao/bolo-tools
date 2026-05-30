import { env } from "./env.mjs";
import { HttpError } from "./http-error.mjs";

/**
 * @typedef {{ title: string, url: string, snippet: string, score?: number }} WebSearchResult
 */

export function getWebSearchCapabilities() {
  return {
    tavily: Boolean(env("TAVILY_API_KEY")),
    serper: Boolean(env("SERPER_API_KEY")),
    available: Boolean(env("TAVILY_API_KEY") || env("SERPER_API_KEY")),
  };
}

/**
 * @param {string} query
 * @param {{ depth?: 'basic'|'advanced', maxResults?: number }} opts
 * @returns {Promise<{ query: string, provider: string, answer?: string, results: WebSearchResult[] }>}
 */
export async function searchWeb(query, opts = {}) {
  const q = String(query || "").trim();
  if (!q) throw new HttpError(400, "请输入搜索内容");

  const depth = opts.depth === "basic" ? "basic" : "advanced";
  const maxResults = Math.min(12, Math.max(3, Number(opts.maxResults) || 8));

  if (env("TAVILY_API_KEY")) {
    return searchWithTavily(q, { depth, maxResults });
  }
  if (env("SERPER_API_KEY")) {
    return searchWithSerper(q, { maxResults });
  }

  throw new HttpError(
    503,
    "未配置全网搜索。请在 .env 设置 TAVILY_API_KEY（推荐，https://tavily.com）或 SERPER_API_KEY（https://serper.dev）",
  );
}

async function searchWithTavily(query, { depth, maxResults }) {
  const apiKey = env("TAVILY_API_KEY");
  const body = {
    api_key: apiKey,
    query,
    search_depth: depth,
    include_answer: true,
    include_raw_content: false,
    max_results: maxResults,
  };

  let data;
  try {
    const res = await fetch("https://api.tavily.com/search", {
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
    throw new HttpError(502, `无法连接 Tavily：${(e.message || String(e)).slice(0, 120)}`);
  }

  const results = (data.results || []).map((r) => ({
    title: String(r.title || "").trim() || "未命名页面",
    url: String(r.url || "").trim(),
    snippet: String(r.content || r.snippet || "").trim().slice(0, 600),
    score: typeof r.score === "number" ? r.score : undefined,
  })).filter((r) => r.url);

  return {
    query,
    provider: "tavily",
    answer: typeof data.answer === "string" ? data.answer.trim() : undefined,
    results,
  };
}

async function searchWithSerper(query, { maxResults }) {
  const apiKey = env("SERPER_API_KEY");
  let data;
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        q: query,
        num: maxResults,
      }),
    });
    data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new HttpError(res.status >= 500 ? 502 : 422, data?.message || `Serper 错误（${res.status}）`);
    }
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, `无法连接 Serper：${(e.message || String(e)).slice(0, 120)}`);
  }

  const organic = data.organic || [];
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
