import JSZip from "jszip";
import { HttpError } from "./http-error.mjs";
import {
  formatArtifactImage,
  formatArtifactImageReply,
  formatArtifactLink,
  putChatArtifact,
} from "./chat-tool-artifacts.mjs";
import {
  fetchRemoteImage,
  findAndFetchImage,
  findVerifiedImageBatch,
  imageSearchConfigured,
  xiaohongshuImageSearchAvailable,
  detectImagePlatforms,
  normalizePlatformIds,
  IMAGE_PLATFORMS,
} from "./image-search.mjs";
import {
  formatImageNotFound,
  formatImageSearchUnavailable,
  toUserFacingErrorMessage,
} from "../../shared/public-error.mjs";
import { formatVerifyFailedReply } from "./media-verify.mjs";
import { understandImageFetchRequest } from "./image-fetch-understand.mjs";
import { resolveChatConfig } from "./chat-config.mjs";
import {
  stripImageSearchNoise,
  buildGeneralSearchVariants,
} from "./image-search-query.mjs";

const IMAGE_FETCH_INTENT_RE =
  /(?:logo|标志|商标|图标|icon|徽标|配图|海报|封面图|头像|小红书|xiaohongshu|xhs|抖音|douyin|淘宝|taobao|天猫|美团|meituan|微信|wechat|公众号)/i;
const IMAGE_FETCH_ACTION_RE =
  /(?:给我|帮我|请|要|想要|找|搜|查|发|提供|展示|显示|看看|下载|来一?张|出一?张|直接)/i;
const DIRECT_IMAGE_URL_RE =
  /https?:\/\/\S+\.(?:png|jpe?g|webp|gif)(?:\?\S*)?/i;

const QUERY_PATTERNS = [
  /(?:我要|给我|帮我|请)?(?:找|搜|查|发|提供|展示|显示|要|想要|看看|下载)?[「『""]?([^」』""?\n，。！？!?]{2,40})[」』""]?(?:的)?(?:产品)?(?:海报|宣传图|广告图|主视觉)/i,
  /(?:我要|给我|帮我|请)?(?:找|搜|查|发|提供|展示|显示|要|想要|看看|下载)?[「『""]?([^」』""?\n，。！？!?]{2,40})[」』""]?(?:的)?(?:logo|标志|商标|图标|icon|徽标)/i,
  /[「『""]([^」』""]{2,40})[」』""](?:的)?(?:产品)?(?:海报|宣传图|logo|标志|商标|图标)/i,
  /([^，。！？!?\s]{2,30})(?:的)?(?:产品)?(?:海报|宣传图|广告图)/i,
  /([^，。！？!?\s]{2,30})(?:的)?(?:logo|标志|商标|图标|icon|徽标)/i,
  /(?:logo|标志|商标|图标|icon|徽标)[：:\s]*([^，。！？!?\s]{2,30})/i,
];

const DEFAULT_POSTER_REJECT = [
  "排行榜截图",
  "榜单截图",
  "商品列表",
  "商城界面",
  "APP截图",
  "多商品拼接",
  "无关竞品合集",
];

function stripQueryNoise(raw) {
  return String(raw || "")
    .replace(/^(?:请|帮我?|给我|麻烦|能否|可以)/, "")
    .replace(/(?:在)?(?:对话|聊天)(?:中|里)?/, "")
    .replace(/为什么.*$/i, "")
    .replace(/不可以.*$/i, "")
    .replace(/[？?。！!…]+$/g, "")
    .trim();
}

export function wantsXiaohongshuImageSource(text) {
  return /小红书|xiaohongshu|xhs/i.test(String(text || ""));
}

export function detectImagePlatformsFromText(text) {
  return detectImagePlatforms(text);
}

function resolveImagePlatforms({ rawMessage, platforms, preferXhs }) {
  const fromPlan = normalizePlatformIds(platforms || []);
  if (fromPlan.length) return fromPlan;
  const fromText = detectImagePlatforms(rawMessage || "");
  if (fromText.length) return fromText;
  if (preferXhs) return ["xiaohongshu"];
  return [];
}

function platformHintMessage(platforms) {
  const labels = platforms
    .map((id) => IMAGE_PLATFORMS[id]?.label)
    .filter(Boolean);
  if (!labels.length) return "";
  return `\n\n_已优先检索：${labels.join("、")}_`;
}

function xiaohongshuCookieHint(preferXhs, fetched) {
  if (preferXhs && !xiaohongshuImageSearchAvailable() && !/xhscdn|xiaohongshu/.test(fetched.sourceUrl || "")) {
    return "\n\n_提示：在 Safari 登录小红书后运行 `./scripts/setup-xiaohongshu-cookies.sh`，可优先搜到站内笔记配图。_";
  }
  return "";
}

export function detectImageIntentType(text) {
  const msg = String(text || "");
  if (/海报|宣传图|广告图|主视觉|kv/i.test(msg)) return "poster";
  if (/logo|标志|商标|图标|icon/i.test(msg)) return "logo";
  return "general";
}

export { stripImageSearchNoise, buildGeneralSearchVariants } from "./image-search-query.mjs";

/** 从用户原话提取核心主体（品牌/店名/产品） */
export function extractImageSubject(text) {
  const msg = stripQueryNoise(String(text || "").trim());
  if (!msg) return "";

  const about = msg.match(/关于[「『""]?([^」』""，。！？!?\s/的]{2,30})/);
  if (about?.[1]) return stripImageSearchNoise(about[1]);

  const possessive = msg.match(
    /([^，。！？!?\s「『""]{2,30})的(?:相关)?(?:高清)?(?:宣传)?(?:配图|图片|照片|图像|素材)/i,
  );
  if (possessive?.[1]) return stripImageSearchNoise(possessive[1]);

  for (const re of QUERY_PATTERNS) {
    const m = msg.match(re);
    if (m?.[1]) {
      const q = stripImageSearchNoise(m[1]);
      if (q.length >= 2) return q;
    }
  }

  let fallback = msg
    .replace(
      /^(?:请|帮我?|给我|麻烦)?(?:直接)?(?:在)?(?:小红书|xiaohongshu|xhs)?(?:上)?(?:找|搜|查|发|提供|展示|显示|要|想要|看看|下载|来一?张|出一?张)(?:一下|下)?/gi,
      "",
    )
    .replace(/(?:小红书|xiaohongshu|xhs|logo|标志|商标|图标|icon|徽标|图片|配图|封面图|头像|照片|素材)/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/的$/g, "")
    .trim();

  return stripImageSearchNoise(fallback);
}

/** 根据用户原话补全搜索词（避免把「海报」误删） */
export function refineImageSearchQuery(userMessage, extracted) {
  const intent = detectImageIntentType(userMessage);
  let q = stripImageSearchNoise(extracted)
    .replace(/\s*logo\s*$/i, "")
    .replace(/的产品$/g, "")
    .trim();

  if (intent === "poster") {
    if (!/海报|宣传|广告|主视觉/i.test(q)) q = `${q} 产品海报`;
    if (!/官方|品牌/i.test(q)) q = `${q} 官方宣传`;
    return q.replace(/\s+/g, " ").trim().slice(0, 80);
  }

  if (intent === "logo" && !/logo|标志|商标|图标/i.test(q)) {
    return `${q} logo`.trim().slice(0, 80);
  }

  return q.slice(0, 80);
}

export function buildSearchQueryVariants(userMessage, extracted) {
  const intent = detectImageIntentType(userMessage);
  const subject = extractImageSubject(userMessage) || stripImageSearchNoise(extracted);
  const primary = refineImageSearchQuery(userMessage, subject || extracted);
  const core = stripImageSearchNoise(subject || primary);
  const variants = [primary];

  if (intent === "poster") {
    if (core) {
      variants.push(`${core} 产品海报`, `${core} 官方 产品宣传图`);
    }
  } else {
    variants.push(...buildGeneralSearchVariants(core || primary, intent));
  }

  return [...new Set(variants.filter(Boolean))];
}

export function posterRejectHints() {
  return [...DEFAULT_POSTER_REJECT];
}

export function detectImageFetchIntent(text) {
  const raw = String(text || "").trim();
  const msg = stripQueryNoise(raw);
  if (!msg || msg.length > 400) return false;
  if (DIRECT_IMAGE_URL_RE.test(msg)) return true;
  if (/压缩包|素材包|图包|整理成.*包|打包/.test(msg) && /图|照|素材|配图|海报/.test(msg)) return true;
  if (/的(?:相关)?(?:高清)?(?:宣传)?(?:配图|图片|照片|图像|素材)/.test(msg)) return true;
  if (IMAGE_FETCH_INTENT_RE.test(msg) || IMAGE_FETCH_INTENT_RE.test(raw)) return true;
  if (
    (IMAGE_FETCH_ACTION_RE.test(msg) || IMAGE_FETCH_ACTION_RE.test(raw)) &&
    /(?:图|图片|素材|配图|照)/.test(raw)
  ) {
    return true;
  }
  return false;
}

export function extractImageQuery(text) {
  const msg = stripQueryNoise(String(text || "").trim());
  if (!msg) return null;

  const direct = msg.match(DIRECT_IMAGE_URL_RE);
  if (direct?.[0]) return direct[0].trim();

  for (const re of QUERY_PATTERNS) {
    const m = msg.match(re);
    if (m?.[1]) {
      let q = m[1]
        .replace(/^(?:一张|一个|一下|看看|显示|展示|提供|下载)/, "")
        .replace(/的产品$/g, "")
        .replace(/的$/g, "")
        .trim();
      if (q.length >= 2) {
        return refineImageSearchQuery(msg, q);
      }
    }
  }

  const subject = extractImageSubject(msg);
  if (subject.length >= 2) {
    return refineImageSearchQuery(msg, subject);
  }

  return null;
}

function escapeMd(text) {
  return String(text || "").replace(/[\[\]]/g, "");
}

export async function fetchImageReplyForQuery(query, {
  title,
  preferXhs = false,
  platforms = [],
  rawMessage,
  intentType,
  queryVariants,
  understanding,
  subject,
} = {}) {
  const q = String(query || "").trim();
  if (!q) throw new HttpError(400, "请说明要找什么图片");

  const sourceText = rawMessage || title || q;
  const resolvedIntent = intentType || detectImageIntentType(sourceText);

  try {
    if (DIRECT_IMAGE_URL_RE.test(q)) {
      const fetched = await findAndFetchImageFromUrl(q);
      return formatFetchedImageReply(fetched, title || "图片", understanding);
    }

    const resolvedPlatforms = resolveImagePlatforms({ rawMessage: sourceText, platforms, preferXhs });
    const variants =
      Array.isArray(queryVariants) && queryVariants.length
        ? queryVariants
        : buildSearchQueryVariants(sourceText, q);
    const fetched = await findAndFetchImage(q, {
      preferXhs: resolvedPlatforms.includes("xiaohongshu") || preferXhs,
      platforms: resolvedPlatforms,
      rawMessage: sourceText,
      intentType: resolvedIntent,
      queryVariants: variants,
      subject: subject || stripImageSearchNoise(sourceText) || q,
    });
    let text = formatFetchedImageReply(fetched, title || q, understanding);
    text += platformHintMessage(resolvedPlatforms);
    text += xiaohongshuCookieHint(resolvedPlatforms.includes("xiaohongshu"), fetched);
    return text;
  } catch (e) {
    if (e instanceof HttpError) {
      if (e.message === "NO_IMAGE_CANDIDATES" || e.statusCode === 404) {
        throw new HttpError(404, formatImageNotFound(q));
      }
      if (e.statusCode === 422) {
        throw new HttpError(422, formatVerifyFailedReply(q, "image", e.message, { intentType: resolvedIntent }));
      }
      throw e;
    }
    throw new HttpError(502, formatImageNotFound(q));
  }
}

async function findAndFetchImageFromUrl(url) {
  const fetched = await fetchRemoteImage(url);
  return { ...fetched, title: "图片", sourceUrl: url };
}

async function buildImageCollectionZip(images, label) {
  const zip = new JSZip();
  images.forEach((img, i) => {
    const safe = String(img.title || `image-${i + 1}`)
      .replace(/[^\w\u4e00-\u9fff-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || `image-${i + 1}`;
    zip.file(`${String(i + 1).padStart(2, "0")}-${safe}.${img.ext}`, img.buffer);
  });
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const zipName = `${String(label || "images")
    .replace(/[^\w\u4e00-\u9fff-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30) || "images"}-${Date.now()}.zip`;
  const zipId = putChatArtifact({
    buffer,
    filename: zipName,
    contentType: "application/zip",
  });
  return { zipId, zipName };
}

function formatCollectionReply({ images, zipId, zipName, label, understanding }) {
  const safeLabel = escapeMd(label || "素材");
  let text = `**已整理：${safeLabel}（${images.length} 张高清图）**\n\n`;
  const understood = String(understanding || "").trim();
  if (understood) {
    text = `_理解：${escapeMd(understood)}_\n\n${text}`;
  }
  text += `${formatArtifactLink(zipId, `下载压缩包 ${zipName}`)}\n\n`;
  text += "**预览：**\n\n";
  for (const preview of images) {
    const previewId = putChatArtifact({
      buffer: preview.buffer,
      filename: `preview-${Date.now()}-${preview.ext}`,
      contentType: preview.contentType,
    });
    text += `${formatArtifactImage(previewId, escapeMd(preview.title || safeLabel))}\n\n`;
  }
  text += "_✓ 已过滤平台图标、低清晰度与无关截图_";
  return text;
}

async function fetchImageCollectionReply(plan) {
  const platforms = resolveImagePlatforms({
    rawMessage: plan.displayLabel,
    platforms: plan.platforms,
    preferXhs: plan.preferXiaohongshu,
  });
  const images = await findVerifiedImageBatch(plan.searchQuery, {
    preferXhs: platforms.includes("xiaohongshu") || plan.preferXiaohongshu,
    platforms,
    intentType: plan.intentType || "materials",
    queryVariants: plan.searchVariants,
    maxImages: plan.maxImages,
    rejectHints: plan.rejectHints,
    subject: plan.subject,
  });

  if (!plan.bundleZip) {
    const first = images[0];
    return formatFetchedImageReply(first, plan.displayLabel, plan.understanding);
  }

  const { zipId, zipName } = await buildImageCollectionZip(images, plan.displayLabel);
  return formatCollectionReply({
    images,
    zipId,
    zipName,
    label: plan.displayLabel,
    understanding: plan.understanding,
  });
}

function formatFetchedImageReply(fetched, label, understanding) {
  const safeLabel = escapeMd(label || "图片");
  const id = putChatArtifact({
    buffer: fetched.buffer,
    filename: `${String(label || "image")
      .replace(/[^\w\u4e00-\u9fff-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "image"}-${Date.now()}.${fetched.ext}`,
    contentType: fetched.contentType,
  });

  let text = formatArtifactImageReply(`已找到：${safeLabel}`, id, safeLabel);
  const understood = String(understanding || "").trim();
  if (understood) {
    text = `_理解：${escapeMd(understood)}_\n\n${text}`;
  }
  if (fetched.verified) {
    text += "\n\n_✓ 已通过大模型检索与平台内容校验_";
  }
  if (fetched.sourceUrl) {
    text += `\n\n_来源：${fetched.sourceUrl}_`;
  }
  return text;
}

async function resolveImageFetchPlan(userMessage, history = []) {
  if (resolveChatConfig()) {
    try {
      const understood = await understandImageFetchRequest(userMessage, history);
      if (understood?.needsImageFetch === false) return null;
      if (understood?.needsImageFetch && understood.searchQuery) return understood;
    } catch {
      // fall back to regex
    }
  }

  if (!detectImageFetchIntent(userMessage)) return null;

  const isCollection = /压缩包|素材包|图包|整理成.*包|打包|多张|一批/.test(userMessage);
  const subject = extractImageSubject(userMessage) || "";
  let query = subject
    ? (isCollection ? `${subject} 宣传配图` : refineImageSearchQuery(userMessage, subject))
    : extractImageQuery(userMessage);
  if (!query) return null;

  query = stripImageSearchNoise(query) || query;
  const intentType = isCollection ? "materials" : detectImageIntentType(userMessage);
  const variants = subject
    ? [
        ...buildGeneralSearchVariants(subject, intentType),
        `${subject} 小红书 配图`,
        `${subject} 抖音 宣传图`,
        `${subject} 微信公众号 配图`,
        `${subject} 淘宝 商品主图`,
        `${subject} 美团 配图`,
      ]
    : buildSearchQueryVariants(userMessage, query);

  const detectedPlatforms = detectImagePlatforms(userMessage);

  return {
    needsImageFetch: true,
    fetchMode: isCollection ? "collection" : "single",
    intentType,
    subject: subject || stripImageSearchNoise(query) || query,
    searchQuery: query,
    searchVariants: [...new Set(variants)].filter((v) => v && v !== query),
    platforms: detectedPlatforms,
    preferXiaohongshu: wantsXiaohongshuImageSource(userMessage),
    rejectHints: isCollection ? ["微信图标", "平台logo", "模糊", "低清晰度"] : [],
    maxImages: isCollection ? 20 : 1,
    bundleZip: isCollection,
    displayLabel: query,
    understanding: "",
  };
}

/**
 * @param {string} query
 * @param {string} rawMessage
 * @param {{ platforms?: string[], preferXhs?: boolean }} [opts]
 */
export function buildAgentImageFetchPlan(query, rawMessage, { platforms = [], preferXhs = false } = {}) {
  const userMessage = String(rawMessage || query || "").trim();
  const q = String(query || "").trim();
  if (!q) return null;

  const isCollection = /压缩包|素材包|图包|整理成.*包|打包|多张|一批/.test(userMessage);
  const subject = extractImageSubject(userMessage) || "";
  const cleanedQuery = stripImageSearchNoise(q) || q;
  const intentType = isCollection ? "materials" : detectImageIntentType(userMessage);
  const variants = subject
    ? [
        ...buildGeneralSearchVariants(subject, intentType),
        `${subject} 小红书 配图`,
        `${subject} 抖音 宣传图`,
        `${subject} 微信公众号 配图`,
        `${subject} 淘宝 商品主图`,
        `${subject} 美团 配图`,
      ]
    : buildSearchQueryVariants(userMessage, cleanedQuery);

  const detectedPlatforms = platforms.length ? normalizePlatformIds(platforms) : detectImagePlatforms(userMessage);

  return {
    needsImageFetch: true,
    fetchMode: isCollection ? "collection" : "single",
    intentType,
    subject: subject || stripImageSearchNoise(cleanedQuery) || cleanedQuery,
    searchQuery: cleanedQuery,
    searchVariants: [...new Set(variants)].filter((v) => v && v !== cleanedQuery),
    platforms: detectedPlatforms,
    preferXiaohongshu: preferXhs || detectedPlatforms.includes("xiaohongshu"),
    rejectHints: isCollection ? ["微信图标", "平台logo", "模糊", "低清晰度"] : [],
    maxImages: isCollection ? 20 : 1,
    bundleZip: isCollection,
    displayLabel: cleanedQuery,
    understanding: "",
  };
}

/**
 * @param {object} plan
 * @param {string} userMessage
 * @returns {Promise<string>}
 */
export async function runImageFetchPlan(plan, userMessage) {
  const query = plan.searchQuery;
  const platforms = resolveImagePlatforms({
    rawMessage: userMessage,
    platforms: plan.platforms,
    preferXhs: plan.preferXiaohongshu,
  });
  const preferXhs =
    platforms.includes("xiaohongshu") || plan.preferXiaohongshu || wantsXiaohongshuImageSource(userMessage);

  if (!imageSearchConfigured() && !DIRECT_IMAGE_URL_RE.test(query)) {
    return formatImageSearchUnavailable();
  }

  const fetchOpts = {
    preferXhs,
    platforms,
    rawMessage: userMessage,
    intentType: plan.intentType,
    queryVariants: plan.searchVariants,
    understanding: plan.understanding,
    subject: plan.subject || stripImageSearchNoise(query),
  };

  try {
    if (plan.fetchMode === "collection") {
      return await fetchImageCollectionReply(plan);
    }
    return await fetchImageReplyForQuery(query, fetchOpts);
  } catch (e) {
    const subject = stripImageSearchNoise(plan.subject || query);
    const canRetry =
      subject &&
      subject.length >= 2 &&
      (e instanceof HttpError
        ? e.message === "NO_IMAGE_CANDIDATES" || e.statusCode === 404 || e.statusCode === 422
        : false);

    if (canRetry) {
      try {
        const retryVariants = [
          ...(plan.searchVariants || []),
          ...buildGeneralSearchVariants(subject, plan.intentType),
        ];
        return await fetchImageReplyForQuery(subject, {
          ...fetchOpts,
          queryVariants: [...new Set(retryVariants)].filter((v) => v && v !== subject),
        });
      } catch {
        // fall through to user-facing error
      }
    }

    if (e instanceof HttpError) {
      if (e.message === "NO_IMAGE_CANDIDATES" || e.statusCode === 404) {
        return formatImageNotFound(subject || plan.subject || query);
      }
      if (e.statusCode === 422) {
        return formatVerifyFailedReply(subject || plan.subject || query, "image", e.message, {
          intentType: plan.intentType,
        });
      }
      return toUserFacingErrorMessage(e.message);
    }
    return formatImageNotFound(subject || plan.subject || query);
  }
}

/**
 * @param {string} userMessage
 * @param {{ role: string, content: string }[]} [history]
 * @returns {Promise<string | null>}
 */
export async function tryImageFetchReply(userMessage, history = []) {
  const plan = await resolveImageFetchPlan(userMessage, history);
  if (!plan?.needsImageFetch || !plan.searchQuery) return null;
  return runImageFetchPlan(plan, userMessage);
}
