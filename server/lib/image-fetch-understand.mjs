import OpenAI from "openai";
import { resolveChatConfig } from "./chat-config.mjs";
import { env } from "./env.mjs";
import {
  buildGeneralSearchVariants,
  stripImageSearchNoise,
  wantsImageZipBundle,
  resolveImageFetchCount,
  DIRECT_IMAGE_URL_RE,
} from "./image-search-query.mjs";
import { parseJsonBlock } from "./parse-json-block.mjs";

const IMAGE_HINT_RE =
  /(?:图|照|海报|宣传|封面|头像|配图|logo|标志|商标|图标|icon|主视觉|kv|小红书|xiaohongshu|xhs)/i;

function formatHistory(history = []) {
  return (Array.isArray(history) ? history : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && String(m.content || "").trim())
    .slice(-10)
    .map((m) => `${m.role === "user" ? "用户" : "助手"}：${String(m.content).trim().slice(0, 800)}`)
    .join("\n\n");
}

function hasImageContextInHistory(history = []) {
  const text = formatHistory(history);
  return /(?:图|照|海报|logo|配图|搜图|找.*图|产品海报|宣传图)/i.test(text);
}

export function shouldTryImageUnderstanding(userMessage, history = []) {
  const msg = String(userMessage || "").trim();
  if (!msg || msg.length > 400) return false;
  if (DIRECT_IMAGE_URL_RE.test(msg)) return true;
  if (IMAGE_HINT_RE.test(msg)) return true;
  if (hasImageContextInHistory(history)) return true;
  return /(?:给我|帮我|请|要|想要|找|搜|查|发|提供|展示|显示|看看|下载|来一?张)/.test(msg);
}

function normalizeIntentType(value) {
  const t = String(value || "").trim().toLowerCase();
  if (t === "poster" || /海报|宣传/.test(t)) return "poster";
  if (t === "logo" || /logo|标志|商标|图标/.test(t)) return "logo";
  if (t === "materials" || /素材|配图集|图包/.test(t)) return "materials";
  return "general";
}

function normalizePlatforms(arr) {
  if (!Array.isArray(arr)) return [];
  const out = new Set();
  for (const raw of arr) {
    const p = String(raw || "").trim().toLowerCase();
    if (/微信|wechat|公众号/.test(p)) out.add("wechat");
    if (/抖音|douyin/.test(p)) out.add("douyin");
    if (/小红书|xhs|xiaohongshu/.test(p)) out.add("xiaohongshu");
    if (/淘宝|taobao|tmall|天猫/.test(p)) out.add("taobao");
    if (/美团|meituan/.test(p)) out.add("meituan");
    if (["wechat", "douyin", "xiaohongshu", "taobao", "meituan"].includes(p)) out.add(p);
  }
  return [...out];
}

function buildPlatformVariants(subject, platforms = []) {
  const core = String(subject || "").trim();
  if (!core) return [];
  const variants = [];
  const map = {
    wechat: `${core} 微信公众号 高清配图`,
    douyin: `${core} 抖音 高清宣传图`,
    xiaohongshu: `${core} 小红书 高清配图`,
    taobao: `${core} 淘宝 商品主图`,
    meituan: `${core} 美团 高清配图`,
  };
  if (platforms.length) {
    for (const p of platforms) {
      if (map[p]) variants.push(map[p]);
    }
  }
  variants.push(`${core} 高清宣传图`);
  variants.push(`${core} 官方 配图`);
  return [...new Set(variants)];
}

function sanitizeList(arr, max = 5, maxLen = 60) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((s) => String(s || "").trim())
    .filter((s) => s.length >= 2)
    .slice(0, max)
    .map((s) => s.slice(0, maxLen));
}

/**
 * 用大模型理解用户要找什么图，再结合对话上下文生成搜索词。
 * @returns {Promise<{
 *   needsImageFetch: boolean,
 *   fetchMode: 'single'|'collection',
 *   intentType: 'poster'|'logo'|'general'|'materials',
 *   subject: string,
 *   searchQuery: string,
 *   searchVariants: string[],
 *   platforms: string[],
 *   preferXiaohongshu: boolean,
 *   rejectHints: string[],
 *   maxImages: number,
 *   bundleZip: boolean,
 *   displayLabel: string,
 *   understanding: string,
 * } | null>}
 */
export async function understandImageFetchRequest(userMessage, history = []) {
  const msg = String(userMessage || "").trim();
  if (!msg) return null;

  if (DIRECT_IMAGE_URL_RE.test(msg)) {
    const url = msg.match(DIRECT_IMAGE_URL_RE)?.[0]?.trim();
    return {
      needsImageFetch: true,
      fetchMode: "single",
      intentType: "general",
      subject: "",
      searchQuery: url,
      searchVariants: [],
      platforms: [],
      preferXiaohongshu: false,
      rejectHints: [],
      maxImages: 1,
      bundleZip: false,
      displayLabel: "图片",
      understanding: "用户提供了图片直链",
    };
  }

  const chatConfig = resolveChatConfig();
  if (!chatConfig || !shouldTryImageUnderstanding(msg, history)) return null;

  const client = new OpenAI({
    apiKey: chatConfig.apiKey,
    baseURL: chatConfig.baseURL,
    timeout: Number(env("IMAGE_UNDERSTAND_TIMEOUT_MS", "20000")) || 20000,
    maxRetries: 0,
  });

  const historyBlock = formatHistory(history);

  const completion = await client.chat.completions.create({
    model: chatConfig.model,
    temperature: 0.15,
    max_tokens: 500,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `你是图片检索意图理解助手。根据用户最新一句话和对话上下文，判断用户是否想获取「已有」的图片素材，并提炼搜索词。

规则：
1. 先理解用户真实意图，再结合上下文补全省略的主体（如「就上面那个」「同款海报」）
2. needsImageFetch=true 当用户要获取/展示/下载图片或素材包，不是要 AI 画新图、不是要纯文字介绍
3. fetchMode：固定为 collection（返回多张预览）；用户说压缩包/素材包时再打包下载
4. subject=核心主题（如「唱无界KTV」），不要把平台名（微信/抖音/小红书/淘宝/美团）当成 subject；用户说「X的图片/照片」时 subject 就是 X
5. intentType：poster=海报；logo=标志；materials=运营配图/宣传素材集；general=其它（含门店/KTV/品牌相关图）
6. searchQuery 用中文。用户只说「X的图片/照片」时，searchQuery 就是 X（如「南京滨江希尔顿」），不要擅自加「酒店外观」「门店环境」等用户没提到的词；只有用户明确要外观/大堂/客房时才加画面类型
7. platforms 从用户话里提取：wechat/douyin/xiaohongshu/taobao/meituan，用于生成备选搜索词
8. searchVariants 给 3-5 个备选，必须带 subject，可含 logo/门店/宣传/官方 等，禁止只搜平台名
9. rejectHints：平台图标、微信图标、模糊低清、无关截图、排行榜；用户说质量差不要则加「低清晰度」「模糊」
10. maxImages：未说明张数时填 4；用户说「几张/一些」填 4，「多张/一批」填 6，明确数字按数字；压缩包/素材包填 20
11. bundleZip：仅当用户明确要压缩包/打包时为 true
12. preferXiaohongshu 仅当用户明确只要小红书
13. 闲聊、问知识、要写文章 → needsImageFetch=false

只输出 JSON：
{"needsImageFetch":true|false,"fetchMode":"single|collection","intentType":"poster|logo|materials|general","subject":"核心主题","searchQuery":"主搜索词","searchVariants":["备选"],"platforms":["wechat","douyin","xiaohongshu","taobao","meituan"],"preferXiaohongshu":false,"rejectHints":["应排除"],"maxImages":10,"bundleZip":false,"displayLabel":"展示标题","understanding":"一句话解释用户意图"}`,
      },
      {
        role: "user",
        content: historyBlock
          ? `对话上下文：\n${historyBlock}\n\n用户最新一句：${msg}`
          : `用户：${msg}`,
      },
    ],
  });

  let parsed;
  try {
    parsed = parseJsonBlock(completion.choices?.[0]?.message?.content || "{}");
  } catch {
    return null;
  }

  if (!parsed?.needsImageFetch) return { needsImageFetch: false };

  const subject = stripImageSearchNoise(String(parsed.subject || "").trim()).slice(0, 40);
  let searchQuery = stripImageSearchNoise(String(parsed.searchQuery || subject || "").trim()).slice(0, 80);
  if (!searchQuery && subject) searchQuery = subject;
  if (!searchQuery) return null;

  const wantsZip = wantsImageZipBundle(msg);
  const intentType = normalizeIntentType(parsed.intentType);
  const platforms = normalizePlatforms(parsed.platforms);
  const platformVariants = buildPlatformVariants(subject || searchQuery, platforms);
  const generalVariants = buildGeneralSearchVariants(subject || searchQuery, intentType);
  const llmVariants = sanitizeList(parsed.searchVariants, 5).map((v) => stripImageSearchNoise(v)).filter(Boolean);
  const searchVariants = [...new Set([...llmVariants, ...generalVariants, ...platformVariants])].filter(
    (v) => v && v !== searchQuery,
  );

  const defaultReject =
    wantsZip || intentType === "materials"
      ? ["微信图标", "平台logo", "应用图标", "模糊", "低清晰度", "无关截图"]
      : [];

  const requestedCount = resolveImageFetchCount(msg);

  return {
    needsImageFetch: true,
    fetchMode: "collection",
    intentType,
    subject: subject || searchQuery,
    searchQuery,
    searchVariants,
    platforms,
    preferXiaohongshu: Boolean(parsed.preferXiaohongshu),
    rejectHints: [...new Set([...sanitizeList(parsed.rejectHints, 8), ...defaultReject])],
    maxImages: requestedCount,
    bundleZip: wantsZip,
    displayLabel: String(parsed.displayLabel || subject || searchQuery).trim().slice(0, 40) || searchQuery,
    understanding: String(parsed.understanding || "").trim().slice(0, 160),
  };
}
