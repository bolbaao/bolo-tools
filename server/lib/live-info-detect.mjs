import { detectRecencyIntent } from "./search-time-context.mjs";
import { isWeatherQuery } from "./weather.mjs";

/** 创作/工具类请求，不应走实时检索（除非同时含明确实时关键词） */
const LIVE_EXCLUDE_RE =
  /(?:帮我写|写一[篇条段]|生成|制作|转换|下载|提取|抠图|压缩|翻译|润色|改写|配音|配画面|做成|ppt|幻灯|pdf|word|gif|字幕|爬虫|找图|配图|海报|logo|网盘资源|转写)/i;

const LIVE_REALTIME_HINT =
  /(?:天气|新闻|热点|热搜|股价|汇率|比分|几点|时间|最新|实时|今天|今日|现在|当前|当下|目前)/;

const TRENDS_RE =
  /(?:抖音|douyin|小红书|xiaohongshu|xhs|热搜|热榜|热点榜|今日热点|有什么热点|热点可以)/i;

const NEWS_RE = /(?:新闻|时事|头条|要闻|发生了什么|最新进展|今日要闻|今日消息)/i;

const FINANCE_RE =
  /(?:股价|股市|汇率|金价|白银|比特币|btc|eth|usd|cny|人民币兑美元|美元汇率|A股|港股|美股|纳指|道指)/i;

const SPORTS_RE = /(?:比分|赛果|赛况|赛程|谁赢了|比赛结果|战报|进球)/i;

const TIME_RE = /(?:几点了|现在几点|当前时间|当地时间|时区|北京时间|纽约时间|伦敦时间|东京时间)/i;

const FACTUAL_LIVE_RE = /(?:今天|今日|现在|当前|最新|实时|目前|当下|刚才|刚刚)/;

const QUESTION_HINT =
  /(?:多少|什么|谁|哪|几|是否|有没有|怎么样|如何|吗|？|\?)/;

/** 是否应跳过对话历史（实时类问题只看当前消息） */
export function shouldSkipSearchHistory(text) {
  return isLiveInfoQuery(text);
}

/** 是否为需要实时数据的问题 */
export function isLiveInfoQuery(text) {
  const msg = String(text || "").trim();
  if (!msg || msg.length > 240) return false;

  if (LIVE_EXCLUDE_RE.test(msg) && !LIVE_REALTIME_HINT.test(msg)) return false;

  if (isWeatherQuery(msg)) return true;
  if (TRENDS_RE.test(msg)) return true;
  if (NEWS_RE.test(msg)) return true;
  if (FINANCE_RE.test(msg)) return true;
  if (SPORTS_RE.test(msg)) return true;
  if (TIME_RE.test(msg)) return true;
  if (detectRecencyIntent(msg)) return true;
  if (FACTUAL_LIVE_RE.test(msg) && QUESTION_HINT.test(msg)) return true;

  return false;
}

/**
 * @returns {"weather"|"trends"|"time"|"finance"|"sports"|"news"|"search"}
 */
export function classifyLiveInfoQuery(text) {
  const msg = String(text || "").trim();
  if (isWeatherQuery(msg)) return "weather";
  if (TRENDS_RE.test(msg)) return "trends";
  if (TIME_RE.test(msg)) return "time";
  if (FINANCE_RE.test(msg)) return "finance";
  if (SPORTS_RE.test(msg)) return "sports";
  if (NEWS_RE.test(msg)) return "news";
  return "search";
}

export function liveInfoKindMeta(kind) {
  const map = {
    weather: { icon: "🌤️", title: "实时天气" },
    trends: { icon: "🔥", title: "实时热点" },
    time: { icon: "🕐", title: "当前时间" },
    finance: { icon: "📈", title: "实时行情" },
    sports: { icon: "⚽", title: "赛况速递" },
    news: { icon: "📰", title: "时事速递" },
    search: { icon: "🔍", title: "实时检索" },
  };
  return map[kind] || map.search;
}
