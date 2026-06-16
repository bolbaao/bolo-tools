import OpenAI from "openai";
import { resolveChatConfig } from "./chat-config.mjs";
import { env } from "./env.mjs";
import { searchWeb } from "./web-search.mjs";
import {
  applyRecencyToSearchPlan,
  detectRecencyIntent,
  getSearchTimeContext,
} from "./search-time-context.mjs";
import {
  applyRegionToSearchPlan,
  detectSearchRegion,
  filterChineseResults,
  rankAndFilterSearchResults,
} from "./search-region-context.mjs";
import { parseJsonBlock } from "./parse-json-block.mjs";
import {
  augmentAcademicPlan,
  getModePlanHint,
  resolveSearchModeConfig,
} from "./ai-search-modes.mjs";
import { searchMediaPlatforms } from "./media-search.mjs";
import { searchWebImages } from "./web-image-search.mjs";
import { searchWebVideos } from "./web-video-search.mjs";

function formatHistory(history = []) {
  return (Array.isArray(history) ? history : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && String(m.content || "").trim())
    .slice(-8)
    .map((m) => `${m.role === "user" ? "用户" : "助手"}：${String(m.content).trim().slice(0, 600)}`)
    .join("\n\n");
}

function sanitizeQuery(text, maxLen = 120) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function sanitizeList(arr, max = 5, maxLen = 120) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((s) => sanitizeQuery(s, maxLen))
    .filter((s) => s.length >= 2)
    .slice(0, max);
}

function dedupeResults(results = []) {
  const seen = new Set();
  const out = [];
  for (const item of results) {
    const url = String(item?.url || "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(item);
  }
  return out;
}

/**
 * 用大模型理解用户问题，生成适合搜索引擎的主检索词与扩散备选词。
 * @param {string} userMessage
 * @param {{ history?: Array<{ role: string, content: string }>, topic?: 'general'|'news', mode?: string }} opts
 * @returns {Promise<{
 *   originalQuery: string,
 *   searchQuery: string,
 *   searchVariants: string[],
 *   understanding: string,
 *   topic: 'general'|'news',
 *   planned: boolean,
 * }>}
 */
export async function planWebSearchQueries(userMessage, opts = {}) {
  const originalQuery = sanitizeQuery(userMessage, 500);
  const modeConfig = resolveSearchModeConfig(opts.mode, originalQuery);
  const forcedTopic = modeConfig.topic === "news" ? "news" : opts.topic === "news" ? "news" : "general";

  if (!originalQuery) {
    return {
      originalQuery: "",
      searchQuery: "",
      searchVariants: [],
      understanding: "",
      topic: forcedTopic,
      planned: false,
      mode: modeConfig.mode,
    };
  }

  const chatConfig = resolveChatConfig();
  if (!chatConfig) {
    let fallbackPlan = applyRegionToSearchPlan(
      applyRecencyToSearchPlan({
        originalQuery,
        searchQuery: originalQuery,
        searchVariants: [],
        understanding: "",
        topic: forcedTopic,
        planned: false,
        mode: modeConfig.mode,
      }),
      modeConfig.regionOverride || detectSearchRegion(originalQuery),
      { skipAugment: modeConfig.skipChinaAugment },
    );
    if (modeConfig.academic) fallbackPlan = augmentAcademicPlan(fallbackPlan);
    return fallbackPlan;
  }

  const historyBlock = formatHistory(opts.history);
  const time = getSearchTimeContext();
  const region = modeConfig.regionOverride || detectSearchRegion(originalQuery);
  const recencyIntent = detectRecencyIntent(originalQuery) || forcedTopic === "news";
  const regionHint = modeConfig.multilingual
    ? "多语言模式：保留用户原语言检索词，必要时补充英文或目标语言关键词，不要强行翻译成中文。"
    : region.userSpecified
      ? `用户指定检索区域为「${region.label}」，检索词可带该区域词。`
      : "用户未指定区域，默认按中国（国内/国产）信息检索，检索词优先用中文并带「中国/国产」等语境。";
  const topicHint = recencyIntent
    ? `用户关注近期/当下信息。检索词必须带当前年份 ${time.year} 或「${time.year}年${time.month}月/近期/热播/最新」，禁止只搜 ${time.year - 1} 年。影视剧类 topic 填 general。`
    : forcedTopic === "news"
      ? "用户关注时事热点，topic 填 news，检索词应突出最新进展、时间、事件主体。"
      : "默认 topic 为 general。";
  const modeHint = getModePlanHint(modeConfig.mode);

  const client = new OpenAI({
    apiKey: chatConfig.apiKey,
    baseURL: chatConfig.baseURL,
    timeout: Number(env("WEB_SEARCH_UNDERSTAND_TIMEOUT_MS", "20000")) || 20000,
    maxRetries: 0,
  });

  let parsed;
  try {
    const completion = await client.chat.completions.create({
      model: chatConfig.model,
      temperature: 0.15,
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `你是全网搜索意图理解助手。根据用户问题和对话上下文，提炼适合搜索引擎的检索词。
当前日期：${time.dateLabel}（搜索时必须以此时刻为准，今年是 ${time.year} 年）。

核心原则：
1. 先理解用户真实意图，禁止把用户原话直接当作 searchQuery
2. 将口语、模糊描述、省略主语的问题改写为简洁的中文检索词（可含英文专有名词）
3. 结合上下文补全省略信息（如「就上面那个」「它最新进展」）
4. searchQuery 是主检索词，1 条即可，面向搜索引擎而非聊天
5. searchVariants 给 3-5 条扩散检索词：换角度、同义词、相关实体、上下游概念、官方/教程/新闻等不同维度
6. 扩散词必须与主意图相关，禁止无关泛化或只搜单个泛词
7. 用户问「怎么做/教程/方法」→ 检索词带「教程」「步骤」「示例」
8. 用户问「是什么/介绍/区别」→ 检索词带「介绍」「原理」「对比」
9. 用户问价格、时间、地点等事实 → 检索词直接锁定实体 + 属性
10. ${topicHint}
11. 用户问「最近/很火/热播/当下」的剧、电影、新闻、产品 → 检索词必须含 ${time.year} 或明确时效词；影视剧用 general，新闻用 news
12. 不要把模型训练记忆里的年份当作「今年」；今年是 ${time.year}
13. ${regionHint}
14. ${modeHint}

只输出 JSON：
{"searchQuery":"主检索词","searchVariants":["扩散词1","扩散词2"],"topic":"general|news","understanding":"一句话说明你如何理解用户问题"}`,
        },
        {
          role: "user",
          content: historyBlock
            ? `对话上下文：\n${historyBlock}\n\n用户最新问题：${originalQuery}`
            : `用户问题：${originalQuery}`,
        },
      ],
    });
    parsed = parseJsonBlock(completion.choices?.[0]?.message?.content || "{}");
  } catch {
    let fallbackPlan = applyRegionToSearchPlan(
      applyRecencyToSearchPlan({
        originalQuery,
        searchQuery: originalQuery,
        searchVariants: [],
        understanding: "",
        topic: forcedTopic,
        planned: false,
        mode: modeConfig.mode,
      }),
      region,
      { skipAugment: modeConfig.skipChinaAugment },
    );
    if (modeConfig.academic) fallbackPlan = augmentAcademicPlan(fallbackPlan);
    return fallbackPlan;
  }

  let searchQuery = sanitizeQuery(parsed.searchQuery);
  if (!searchQuery) searchQuery = originalQuery;

  let searchVariants = sanitizeList(parsed.searchVariants, modeConfig.maxVariants).filter(
    (v) => v && v !== searchQuery,
  );
  const topic =
    parsed.topic === "news" || forcedTopic === "news" || recencyIntent ? "news" : "general";

  let plan = applyRegionToSearchPlan(
    applyRecencyToSearchPlan({
      originalQuery,
      searchQuery,
      searchVariants,
      understanding: sanitizeQuery(parsed.understanding, 200),
      topic,
      planned: true,
      mode: modeConfig.mode,
    }),
    region,
    { skipAugment: modeConfig.skipChinaAugment },
  );

  if (modeConfig.academic) {
    plan = augmentAcademicPlan(plan);
  }

  if (modeConfig.maxVariants >= 0) {
    plan.searchVariants = (plan.searchVariants || []).slice(0, modeConfig.maxVariants);
  }

  return plan;
}

/**
 * 理解用户问题后做多路扩散检索，合并去重结果。
 * @param {string} userMessage
 * @param {{ depth?: 'basic'|'advanced', maxResults?: number, topic?: 'general'|'news', days?: number, history?: object[], mode?: string }} opts
 */
export async function searchWebWithUnderstanding(userMessage, opts = {}) {
  const modeConfig = resolveSearchModeConfig(opts.mode, userMessage);

  if (modeConfig.media) {
    const mediaPayload = await searchMediaPlatforms(userMessage, {
      platforms: opts.mediaPlatforms,
    });
    if (opts.forceChinese !== false) {
      mediaPayload.results = filterChineseResults(mediaPayload.results);
    }
    return mediaPayload;
  }

  if (modeConfig.images) {
    return searchWebImages(userMessage, { maxResults: modeConfig.maxResults });
  }

  if (modeConfig.videos) {
    return searchWebVideos(userMessage, { maxResults: modeConfig.maxResults });
  }

  const plan = await planWebSearchQueries(userMessage, {
    history: opts.history,
    topic: modeConfig.topic,
    mode: modeConfig.mode,
  });

  const depth = opts.depth === "basic" || modeConfig.depth === "basic" ? "basic" : "advanced";
  const maxResults = Math.min(
    12,
    Math.max(3, Number(opts.maxResults) || modeConfig.maxResults || 8),
  );
  const topic = plan.topic;
  const defaultDays = topic === "news" ? (plan.recencyIntent ? 14 : 7) : 0;
  const days =
    Math.min(30, Math.max(1, Number(opts.days) || modeConfig.days || defaultDays)) || undefined;
  const region = plan.region;

  const queries = [plan.searchQuery, ...plan.searchVariants.slice(0, modeConfig.maxVariants)].filter(
    Boolean,
  );
  const uniqueQueries = [...new Set(queries)];

  const perQueryResults = uniqueQueries.length > 1
    ? Math.max(3, Math.ceil(maxResults / uniqueQueries.length))
    : maxResults;

  const payloads = await Promise.all(
    uniqueQueries.map(async (q) => {
      try {
        return await searchWeb(q, {
          depth,
          maxResults: perQueryResults,
          topic,
          days,
          region,
          includeRawContent: modeConfig.includeRawContent,
        });
      } catch (e) {
        if (topic === "news") {
          try {
            return await searchWeb(q, {
              depth,
              maxResults: perQueryResults,
              topic: "general",
              days,
              region,
              includeRawContent: modeConfig.includeRawContent,
            });
          } catch {
            return null;
          }
        }
        return null;
      }
    }),
  );

  const validPayloads = payloads.filter(Boolean);
  if (!validPayloads.length) {
    return searchWeb(plan.searchQuery || plan.originalQuery, {
      depth,
      maxResults,
      topic,
      days,
      region,
      includeRawContent: modeConfig.includeRawContent,
    });
  }

  const primary = validPayloads[0];
  const mergedResults = rankAndFilterSearchResults(
    dedupeResults(validPayloads.flatMap((p) => p.results || [])),
    {
      recencyIntent: plan.recencyIntent,
      timeContext: plan.timeContext,
      region: plan.region,
      maxResults,
      academic: modeConfig.academic,
    },
  );

  const forceChinese = Boolean(opts.forceChinese);
  const finalResults = forceChinese ? filterChineseResults(mergedResults) : mergedResults;

  const answers = validPayloads
    .map((p) => p.answer)
    .filter((a) => typeof a === "string" && a.trim());

  return {
    query: plan.originalQuery,
    searchQuery: plan.searchQuery,
    searchVariants: plan.searchVariants,
    understanding: plan.understanding,
    planned: plan.planned,
    topic: plan.topic,
    recencyIntent: plan.recencyIntent,
    timeContext: plan.timeContext,
    region: plan.region,
    mode: modeConfig.mode,
    modeLabel: modeConfig.label,
    provider: primary.provider,
    answer: answers[0] || primary.answer,
    results: finalResults.length ? finalResults : mergedResults,
    queriesUsed: uniqueQueries,
  };
}
