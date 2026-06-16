import { synthesizeSearchAnswer } from "./ai-search-synthesize.mjs";
import { HttpError } from "./http-error.mjs";
import {
  classifyLiveInfoQuery,
  isLiveInfoQuery,
} from "./live-info-detect.mjs";
import {
  formatLiveInfoReply,
  formatTimeLiveReply,
  formatTrendsLiveReply,
} from "./live-info-format.mjs";
import { fetchTrends } from "./trends-fetch.mjs";
import { searchWebWithUnderstanding } from "./web-search-understand.mjs";
import { getWebSearchCapabilities } from "./web-search.mjs";
import { formatWeatherReply, isWeatherQuery, resolveWeatherSnapshot } from "./weather.mjs";
import { formatSearchNotFound } from "../../shared/public-error.mjs";

async function tryWeatherLiveReply(lastUser, pageContext) {
  const snapshot = await resolveWeatherSnapshot({
    lastUserMessage: lastUser,
    pageContext,
  });

  if (snapshot?.needsLocation) {
    return "请告诉我你想查哪个城市的天气，例如「成都天气」或「北京现在多少度」。";
  }

  if (snapshot?.error) {
    return `暂时查不到天气：${snapshot.error}`;
  }

  return formatWeatherReply(snapshot);
}

function detectTrendsPlatform(text) {
  if (/小红书|xiaohongshu|xhs/i.test(text)) return "xiaohongshu";
  return "douyin";
}

async function tryTrendsLiveReply(lastUser) {
  const platform = detectTrendsPlatform(lastUser);
  const { list, updatedAt } = await fetchTrends(platform, { force: true });
  return formatTrendsLiveReply(platform, list, updatedAt);
}

async function trySearchLiveReply(lastUser, kind) {
  const caps = getWebSearchCapabilities();
  if (!caps.available) {
    throw new HttpError(
      503,
      "实时信息查询需要配置 TAVILY_API_KEY 或 SERPER_API_KEY，配置后重启即可。",
    );
  }

  const topic = kind === "news" || kind === "finance" || kind === "sports" ? "news" : "general";

  const searchPayload = await searchWebWithUnderstanding(lastUser, {
    depth: "advanced",
    topic,
    history: undefined,
  });

  let summary = searchPayload.answer || "";
  try {
    summary = await synthesizeSearchAnswer(lastUser, searchPayload, {
      topic: searchPayload.topic || topic,
      mode: searchPayload.mode,
      liveInfo: true,
    });
  } catch (e) {
    summary =
      summary ||
      (e instanceof HttpError ? e.message : "未能生成 AI 摘要，请查看下方参考来源。");
  }

  if (!summary && !searchPayload.results?.length) {
    return formatSearchNotFound(lastUser);
  }

  return formatLiveInfoReply({
    kind,
    query: lastUser,
    summary,
    results: searchPayload.results,
    fetchedAt: new Date().toISOString(),
  });
}

/**
 * 实时类问题：只解析当前消息，拉取最新数据并返回带卡片块的回复。
 * @param {string} lastUser
 * @param {{ pageContext?: object }} [opts]
 */
export async function tryLiveInfoReply(lastUser, opts = {}) {
  const text = String(lastUser || "").trim();
  if (!isLiveInfoQuery(text)) return null;

  const kind = classifyLiveInfoQuery(text);

  try {
    if (kind === "weather" || isWeatherQuery(text)) {
      return await tryWeatherLiveReply(text, opts.pageContext);
    }

    if (kind === "time") {
      return formatTimeLiveReply(text);
    }

    if (kind === "trends") {
      return await tryTrendsLiveReply(text);
    }

    return await trySearchLiveReply(text, kind);
  } catch (e) {
    if (e instanceof HttpError) {
      return e.message;
    }
    return `暂时无法获取实时信息：${String(e?.message || e).slice(0, 120)}`;
  }
}
