import OpenAI from "openai";
import { HttpError } from "./http-error.mjs";
import { resolveChatConfig, resolveArkVisionConfig } from "./chat-config.mjs";
import { env } from "./env.mjs";
import { searchWeb, getWebSearchCapabilities } from "./web-search.mjs";
import { photoVisionConfigured } from "./photo-vision.mjs";
import { parseJsonBlock } from "./parse-json-block.mjs";

const PLATFORM_RE =
  /xiaohongshu|xhscdn|douyin|iesdouyin|douyinvod|douyinstatic|douyinpic|snssdk|amemv|taobao|tmall|alicdn|meituan|mp\.weixin|mmbiz\.qpic|wx\.qlogo/i;

export function isPlatformMediaSource(meta = {}) {
  const text = `${meta.domain || ""} ${meta.pageUrl || ""} ${meta.url || ""} ${meta.source || ""}`;
  return PLATFORM_RE.test(text);
}

export function mediaVerifyEnabled() {
  if (env("MEDIA_VERIFY") === "0") return false;
  return Boolean(getWebSearchCapabilities().available && resolveChatConfig());
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

/**
 * 大模型 + 全网搜索：建立「预期内容」摘要
 * @param {string} query
 * @param {'image'|'video'} mediaType
 */
const DEFAULT_IMAGE_REJECT = [
  "排行榜截图",
  "榜单截图",
  "商品列表页",
  "商城界面截图",
  "APP界面截图",
  "多商品合集拼图",
];

export async function buildMediaVerifyBrief(query, mediaType = "image", opts = {}) {
  const q = String(query || "").trim();
  if (!q) throw new HttpError(400, "缺少检索关键词");
  const intentType = opts.intentType || "general";

  const chatConfig = resolveChatConfig();
  if (!getWebSearchCapabilities().available) {
    return {
      subject: q,
      keywords: tokenize(q),
      expectedDescription: q,
      referenceTitles: [],
      rejectHints: intentType === "poster" ? [...DEFAULT_IMAGE_REJECT] : [],
      intentType,
      searchSummary: "",
      source: "query-only",
    };
  }

  const searchPayload = await searchWeb(q, { depth: "advanced", maxResults: 8 });
  if (!chatConfig) {
    return {
      subject: q,
      keywords: tokenize(q),
      expectedDescription: searchPayload.answer || q,
      referenceTitles: (searchPayload.results || []).map((r) => r.title).slice(0, 6),
      rejectHints: intentType === "poster" ? [...DEFAULT_IMAGE_REJECT] : [],
      intentType,
      searchSummary: searchPayload.answer || "",
      source: "search-only",
    };
  }

  const sources = (searchPayload.results || [])
    .slice(0, 8)
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`)
    .join("\n\n");

  const client = new OpenAI({
    apiKey: chatConfig.apiKey,
    baseURL: chatConfig.baseURL,
    timeout: Number(env("MEDIA_VERIFY_TIMEOUT_MS", "60000")) || 60000,
    maxRetries: 0,
  });

  const typeHint =
    mediaType === "video"
      ? "用户在找视频，请总结视频主题、出镜主体、场景与可核验标题线索。"
      : intentType === "poster"
        ? "用户在找「产品海报/宣传主视觉」，请总结品牌、单品名称、包装/瓶身特征、海报风格。rejectHints 必须包含：排行榜、榜单、商品列表、商城截图、界面截图。"
        : intentType === "materials"
          ? "用户在找某主题的高清宣传配图素材（可能来自微信/抖音/小红书），请总结主题名称、画面元素、风格。subject 只用用户检索词中的核心品牌/产品名，不要臆造公司全称或业务细节。rejectHints 必须包含：微信图标、平台logo、模糊低清、无关截图。"
          : "用户在找图片，请总结画面主体、品牌/人物/物体、风格。subject 保持检索词核心名即可，不要补充未在检索结果出现的公司全称、授权、系统型号等细节。";

  const completion = await client.chat.completions.create({
    model: chatConfig.model,
    messages: [
      {
        role: "system",
        content: `你是媒体内容校验助手。根据全网检索结果，提炼用户要找的${mediaType === "video" ? "视频" : "图片"}「预期内容」。
只输出 JSON，不要其它文字：
{"subject":"一句话主体","keywords":["词1","词2"],"expectedDescription":"2-4句描述","referenceTitles":["标题"],"rejectHints":["应排除的内容"]}`,
      },
      {
        role: "user",
        content: `${typeHint}\n用户检索词：${q}\n\n搜索引擎摘要：${searchPayload.answer || "无"}\n\n检索来源：\n${sources || "无"}`,
      },
    ],
    temperature: 0.2,
    max_tokens: 800,
  });

  const text = completion.choices?.[0]?.message?.content?.trim();
  let parsed;
  try {
    parsed = parseJsonBlock(text || "{}");
  } catch {
    parsed = {
      subject: q,
      keywords: tokenize(q),
      expectedDescription: searchPayload.answer || q,
      referenceTitles: [],
      rejectHints: [],
    };
  }

  const rejectHints = Array.isArray(parsed.rejectHints)
    ? parsed.rejectHints.map((t) => String(t).trim()).filter(Boolean)
    : [];

  return {
    subject: String(parsed.subject || q).trim(),
    keywords: Array.isArray(parsed.keywords)
      ? parsed.keywords.map((k) => String(k).trim()).filter(Boolean)
      : tokenize(parsed.subject || q),
    expectedDescription: String(parsed.expectedDescription || searchPayload.answer || q).trim(),
    referenceTitles: Array.isArray(parsed.referenceTitles)
      ? parsed.referenceTitles.map((t) => String(t).trim()).filter(Boolean)
      : [],
    rejectHints: [...new Set([...rejectHints, ...(intentType === "poster" ? DEFAULT_IMAGE_REJECT : [])])],
    intentType,
    searchSummary: searchPayload.answer || "",
    source: "llm-search",
  };
}

function keywordScore(haystack, keywords) {
  const text = String(haystack || "").toLowerCase();
  if (!text || !keywords?.length) return 0;
  let hit = 0;
  for (const kw of keywords) {
    if (kw && text.includes(String(kw).toLowerCase())) hit += 1;
  }
  return hit / keywords.length;
}

function coreSubjectTokens(subject, query) {
  const raw = `${subject || ""} ${query || ""}`.trim();
  const tokens = new Set();
  const zh = raw.match(/[\u4e00-\u9fff]{2,}/g) || [];
  for (const t of zh) tokens.add(t);
  for (const t of tokenize(raw)) tokens.add(t);
  return [...tokens].filter((t) => t.length >= 2);
}

function subjectMatchesCandidate(subject, query, platformMeta = {}) {
  const hay = `${platformMeta.title || ""} ${platformMeta.pageUrl || ""} ${platformMeta.url || ""} ${platformMeta.domain || ""}`;
  if (!hay.trim()) return false;
  const tokens = coreSubjectTokens(subject, query);
  if (!tokens.length) return false;
  return tokens.some((t) => hay.includes(t));
}

async function judgeWithTextLLM({ brief, query, candidateText, mediaType, platformMeta }) {
  const chatConfig = resolveChatConfig();
  if (!chatConfig) {
    const score = keywordScore(candidateText, brief.keywords);
    return { match: score >= 0.34, reason: score >= 0.34 ? "关键词匹配" : "关键词匹配不足" };
  }

  const client = new OpenAI({
    apiKey: chatConfig.apiKey,
    baseURL: chatConfig.baseURL,
    timeout: 45000,
    maxRetries: 0,
  });

  const completion = await client.chat.completions.create({
    model: chatConfig.model,
    messages: [
      {
        role: "system",
        content:
          '判断「平台抓取内容」是否与「大模型全网检索预期」一致。general/materials 需求：画面与主题品牌/产品相关即可，不要求同时出现公司全称、授权字样或全部业务元素。若是产品海报需求，必须是单品牌单产品的宣传海报/主视觉，绝不能是排行榜、榜单、商品列表、商城或APP界面截图。只输出 JSON：{"match":true|false,"reason":"一句话"}',
      },
      {
        role: "user",
        content: `用户检索：${query}
大模型预期主体：${brief.subject}
预期描述：${brief.expectedDescription}
关键词：${(brief.keywords || []).join("、")}
参考标题：${(brief.referenceTitles || []).join("；") || "无"}
应排除：${(brief.rejectHints || []).join("；") || "无"}

平台来源：${platformMeta?.source || platformMeta?.domain || "未知"}
平台${mediaType === "video" ? "视频" : "图片"}线索：
${candidateText}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 300,
  });

  try {
    const parsed = parseJsonBlock(completion.choices?.[0]?.message?.content || "{}");
    return {
      match: Boolean(parsed.match),
      reason: String(parsed.reason || "").trim() || (parsed.match ? "校验通过" : "校验未通过"),
    };
  } catch {
    const score = keywordScore(candidateText, brief.keywords);
    return { match: score >= 0.34, reason: "LLM 校验回退到关键词匹配" };
  }
}

async function judgeImageWithVision(dataUrl, brief, query, platformMeta) {
  const cfg = resolveArkVisionConfig();
  if (!cfg) return null;

  const response = await fetch(`${cfg.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            {
              type: "text",
              text: `用户要找：${query}
需求类型：${brief.intentType === "poster" ? "产品海报/宣传主视觉（单品）" : "图片"}
大模型全网检索预期：${brief.expectedDescription}
关键词：${(brief.keywords || []).join("、")}
必须排除：${(brief.rejectHints || []).join("、") || "排行榜截图、榜单、商品列表、商城界面"}
平台来源：${platformMeta?.source || platformMeta?.domain || "平台"}

请判断：
1) 画面是否与主题品牌/产品相关（general/materials 允许宣传图、门店、产品界面、logo 等，不要求出现公司全称或授权字样）
2) 若是海报需求，必须是宣传海报而非截图/榜单/列表
3) 明显是抖音/小红书商城排行榜、商品榜单、界面截图 → match=false

只输出 JSON：{"match":true|false,"reason":"一句话"}`,
            },
          ],
        },
      ],
      max_tokens: 220,
      temperature: 0.1,
    }),
    signal: AbortSignal.timeout(60000),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) return null;
  try {
    const parsed = parseJsonBlock(data?.choices?.[0]?.message?.content || "{}");
    return {
      match: Boolean(parsed.match),
      reason: String(parsed.reason || "").trim() || (parsed.match ? "图像校验通过" : "图像校验未通过"),
    };
  } catch {
    return null;
  }
}

/**
 * @param {{ buffer: Buffer, contentType: string, brief: object, query: string, platformMeta?: object }} args
 */
function posterTitleRejected(platformMeta = {}) {
  const hay = `${platformMeta.title || ""} ${platformMeta.pageUrl || ""}`.toLowerCase();
  return /排行榜|榜单|热卖榜|畅销榜|商品列表|商城.*榜|top\s*\d|微信图标|wechat\s*icon|app\s*icon|platform\s*logo/.test(hay);
}

export async function verifyImageAgainstBrief({ buffer, contentType, brief, query, platformMeta = {} }) {
  const intent = brief.intentType || "general";
  if (
    intent !== "poster" &&
    subjectMatchesCandidate(brief.subject, query, platformMeta)
  ) {
    return { match: true, reason: "来源线索与检索主题一致" };
  }

  if ((brief.intentType === "poster" || brief.intentType === "materials") && posterTitleRejected(platformMeta)) {
    return {
      match: false,
      reason:
        brief.intentType === "materials"
          ? "来源标题疑似平台图标/排行榜截图，非主题素材"
          : "来源标题疑似排行榜/商品列表，非产品海报",
    };
  }

  const b64 = buffer.toString("base64");
  const mime = contentType || "image/png";
  const dataUrl = `data:${mime};base64,${b64}`;

  if (photoVisionConfigured()) {
    const vision = await judgeImageWithVision(dataUrl, brief, query, platformMeta);
    if (vision) return vision;
  }

  const textBits = [
    platformMeta.title,
    platformMeta.pageUrl,
    platformMeta.domain,
    brief.expectedDescription,
  ].join("\n");

  return judgeWithTextLLM({
    brief,
    query,
    candidateText: textBits,
    mediaType: "image",
    platformMeta,
  });
}

/**
 * @param {{ title?: string, uploader?: string, duration?: number, webpageUrl?: string, platform?: string, thumbnail?: string }} videoMeta
 */
export async function verifyVideoAgainstBrief(videoMeta, brief, query) {
  const candidateText = [
    `标题：${videoMeta.title || "—"}`,
    `作者：${videoMeta.uploader || "—"}`,
    videoMeta.duration ? `时长：${Math.round(videoMeta.duration)} 秒` : "",
    `链接：${videoMeta.webpageUrl || "—"}`,
    `平台：${videoMeta.platform || "—"}`,
  ]
    .filter(Boolean)
    .join("\n");

  return judgeWithTextLLM({
    brief,
    query: query || videoMeta.title || "",
    candidateText,
    mediaType: "video",
    platformMeta: { source: videoMeta.platform, domain: videoMeta.platform },
  });
}

export function formatVerifyFailedReply(query, mediaType = "image", reason = "", opts = {}) {
  const label = mediaType === "video" ? "视频" : "图片";
  const detail = String(reason || "").trim();
  const reasonLine = detail && detail !== "VERIFY_FAILED" ? `\n\n原因：${detail}` : "";
  const intentType = opts.intentType || "general";
  const posterHint =
    intentType === "poster"
      ? "\n\n已排除排行榜截图、商品列表等非海报图片。"
      : "";
  return `暂未通过内容校验，无法提供该${label}。${reasonLine}${posterHint}

建议：
- 换个更具体的关键词（如「${query || "品牌名"} 官方宣传图」）
- 直接粘贴${label}链接
- 说明要小红书或抖音来源`;
}
