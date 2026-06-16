import JSZip from "jszip";
import { HttpError } from "./http-error.mjs";
import {
  formatArtifactImage,
  formatArtifactLink,
  putChatArtifact,
} from "./chat-tool-artifacts.mjs";
import {
  fetchRemoteImage,
  imageSearchConfigured,
  xiaohongshuImageSearchAvailable,
  detectImagePlatforms,
  normalizePlatformIds,
  IMAGE_PLATFORMS,
} from "./image-search.mjs";
import { fetchVerifiedImages, formatImageSearchNotFound } from "./web-image-search.mjs";
import {
  formatImageSearchUnavailable,
  toUserFacingErrorMessage,
} from "../../shared/public-error.mjs";
import { understandImageFetchRequest } from "./image-fetch-understand.mjs";
import { resolveChatConfig } from "./chat-config.mjs";
import {
  stripImageSearchNoise,
  buildGeneralSearchVariants,
  stripImageRequestFluff,
  parseRequestedImageCount,
  wantsImageZipBundle,
  resolveImageFetchCount,
  DIRECT_IMAGE_URL_RE,
  DEFAULT_IMAGE_REJECT_HINTS,
} from "./image-search-query.mjs";

const IMAGE_FETCH_INTENT_RE =
  /(?:logo|标志|商标|图标|icon|徽标|配图|海报|封面图|头像|小红书|xiaohongshu|xhs|抖音|douyin|淘宝|taobao|天猫|美团|meituan|微信|wechat|公众号)/i;
const IMAGE_FETCH_ACTION_RE =
  /(?:给我|帮我|请|要|想要|找|搜|查|发|提供|展示|显示|看看|下载|来一?张|出一?张|直接)/i;

const QUERY_PATTERNS = [
  /(?:我要|给我|帮我|请)?(?:找|搜|查|发|提供|展示|显示|要|想要|看看|下载)?[「『""]?([^」』""?\n，。！？!?]{2,40})[」』""]?(?:的)?(?:产品)?(?:海报|宣传图|广告图|主视觉)/i,
  /(?:我要|给我|帮我|请)?(?:找|搜|查|发|提供|展示|显示|要|想要|看看|下载)?[「『""]?([^」』""?\n，。！？!?]{2,40})[」』""]?(?:的)?(?:logo|标志|商标|图标|icon|徽标)/i,
  /[「『""]([^」』""]{2,40})[」』""](?:的)?(?:产品)?(?:海报|宣传图|logo|标志|商标|图标)/i,
  /([^，。！？!?\s]{2,30})(?:的)?(?:产品)?(?:海报|宣传图|广告图)/i,
  /([^，。！？!?\s]{2,30})(?:的)?(?:logo|标志|商标|图标|icon|徽标)/i,
  /(?:logo|标志|商标|图标|icon|徽标)[：:\s]*([^，。！？!?\s]{2,30})/i,
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

export function posterRejectHints() {
  return [...DEFAULT_IMAGE_REJECT_HINTS];
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

const FIND_IMAGE_SUBJECT_RE =
  /(?:找|搜|查|发|要|下载|看看|提供|展示|显示)(?:几(?:张|个)?|一些|多张|若干|多个)?(?:张|个)?[「『""]?([\u4e00-\u9fff\w·-]{2,30}?)[」』""]?(?:的)?(?:高清)?(?:配图|图片|照片|图像|素材|图)/i;

const POSSESSIVE_IMAGE_SUBJECT_RE =
  /([\u4e00-\u9fff\w·-]{2,20})的(?:相关)?(?:高清)?(?:宣传)?(?:配图|图片|照片|图像|素材)/i;

function normalizeExtractedSubject(raw) {
  const cleaned = stripImageSearchNoise(stripImageRequestFluff(raw));
  return cleaned.length >= 2 ? cleaned : "";
}

/** 从用户原话提取核心主体（品牌/店名/产品） */
export function extractImageSubject(text) {
  const msg = stripQueryNoise(String(text || "").trim());
  if (!msg) return "";

  const findImage = msg.match(FIND_IMAGE_SUBJECT_RE);
  if (findImage?.[1]) {
    const q = normalizeExtractedSubject(findImage[1]);
    if (q) return q;
  }

  const about = msg.match(/关于[「『""]?([^」』""，。！？!?\s/的]{2,30})/);
  if (about?.[1]) return normalizeExtractedSubject(about[1]);

  const possessive = msg.match(POSSESSIVE_IMAGE_SUBJECT_RE);
  if (possessive?.[1]) return normalizeExtractedSubject(possessive[1]);

  const giveMe = msg.match(
    /(?:给我|帮我|请|要|想要|发|来)(?:几(?:张|个)?|一些|多张|若干|多个)?(?:张|个|一下)?(.{2,40}?)(?:的)?(?:图片|照片|配图|素材|图)/i,
  );
  if (giveMe?.[1]) return normalizeExtractedSubject(giveMe[1]);

  for (const re of QUERY_PATTERNS) {
    const m = msg.match(re);
    if (m?.[1]) {
      const q = stripImageSearchNoise(m[1]);
      if (q.length >= 2) return q;
    }
  }

  let fallback = msg
    .replace(
      /^(?:请|帮我?|给我|麻烦)?(?:直接)?(?:在)?(?:小红书|xiaohongshu|xhs)?(?:上)?(?:找|搜|查|发|提供|展示|显示|要|想要|看看|下载|来一?张|出一?张)(?:几(?:张|个)?|一些|多张|若干|多个)?(?:张|个)?(?:一下|下)?/gi,
      "",
    )
    .replace(/(?:小红书|xiaohongshu|xhs|logo|标志|商标|图标|icon|徽标|图片|配图|封面图|头像|照片|素材)/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/的$/g, "")
    .trim();

  return normalizeExtractedSubject(fallback);
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

function normalizeImageFetchPlan(plan, userMessage) {
  const wantsZip = wantsImageZipBundle(userMessage);
  return {
    ...plan,
    fetchMode: "collection",
    maxImages: resolveImageFetchCount(userMessage),
    bundleZip: wantsZip,
  };
}

export async function fetchImageReplyForQuery(query, {
  title,
  preferXhs = false,
  platforms = [],
  rawMessage,
  intentType,
  queryVariants,
  subject,
  maxImages,
} = {}) {
  const q = String(query || "").trim();
  if (!q) throw new HttpError(400, "请说明要找什么图片");

  const sourceText = rawMessage || title || q;
  const resolvedIntent = intentType || detectImageIntentType(sourceText);

  try {
    if (DIRECT_IMAGE_URL_RE.test(q)) {
      const fetched = await findAndFetchImageFromUrl(q);
      return formatMultiImageReply({ images: [fetched], label: title || "图片" });
    }

    const resolvedPlatforms = resolveImagePlatforms({ rawMessage: sourceText, platforms, preferXhs });
    const variants =
      Array.isArray(queryVariants) && queryVariants.length
        ? queryVariants
        : buildSearchQueryVariants(sourceText, q);
    const payload = await fetchVerifiedImages(q, {
      subject: subject || stripImageSearchNoise(sourceText) || q,
      intentType: resolvedIntent,
      queryVariants: variants,
      platforms: resolvedPlatforms,
      preferXhs: resolvedPlatforms.includes("xiaohongshu") || preferXhs,
      maxResults: maxImages || resolveImageFetchCount(sourceText),
    });
    let text = formatVerifiedImageReply(payload, title || q);
    text += platformHintMessage(resolvedPlatforms);
    text += xiaohongshuCookieHint(resolvedPlatforms.includes("xiaohongshu"), payload.results[0] || {});
    return text;
  } catch (e) {
    if (e instanceof HttpError) {
      if (e.message === "NO_VERIFIED_IMAGES" || e.message === "NO_IMAGE_CANDIDATES" || e.statusCode === 404) {
        throw new HttpError(404, formatImageSearchNotFound(subject || q, { intentType: resolvedIntent }));
      }
      throw e;
    }
    throw new HttpError(502, formatImageSearchNotFound(subject || q));
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

function formatMultiImageReply({ images, label, understanding, verified }) {
  const safeLabel = escapeMd(label || "图片");
  const verifyNote = verified ? "_已通过识图校验，画面与检索主题一致_" : "_已通过关键词校验_";
  let text = `**已找到 ${images.length} 张：${safeLabel}**\n\n`;
  if (understanding) text += `${understanding}\n\n${verifyNote}\n\n`;
  for (const preview of images) {
    const previewId = putChatArtifact({
      buffer: preview.buffer,
      filename: `preview-${Date.now()}-${preview.ext || "png"}`,
      contentType: preview.contentType,
    });
    const detected = preview.detectedKeywords?.length
      ? ` _（识别：${preview.detectedKeywords.slice(0, 4).join("、")}）_`
      : "";
    text += `${formatArtifactImage(previewId, escapeMd(preview.title || safeLabel))}${detected}\n\n`;
  }
  return text.trim();
}

function formatVerifiedImageReply(payload, label) {
  const images = (payload.results || []).map((row) => ({
    buffer: row.buffer,
    contentType: row.contentType,
    ext: row.ext,
    title: row.title,
    detectedKeywords: row.detectedKeywords,
  }));
  return formatMultiImageReply({
    images,
    label,
    understanding: payload.understanding,
    verified: payload.verified,
  });
}

function formatCollectionReply({ images, zipId, zipName, label, understanding, verified }) {
  const safeLabel = escapeMd(label || "素材");
  const verifyNote = verified
    ? "_已通过识图校验，仅保留与主题一致的图片_"
    : "_已通过关键词校验_";
  let text = `**已整理：${safeLabel}（${images.length} 张）**\n\n`;
  if (understanding) text += `${understanding}\n\n${verifyNote}\n\n`;
  text += `${formatArtifactLink(zipId, `下载压缩包 ${zipName}`)}\n\n`;
  text += "**预览：**\n\n";
  for (const preview of images) {
    const previewId = putChatArtifact({
      buffer: preview.buffer,
      filename: `preview-${Date.now()}-${preview.ext || "png"}`,
      contentType: preview.contentType,
    });
    const detected = preview.detectedKeywords?.length
      ? ` _（识别：${preview.detectedKeywords.slice(0, 4).join("、")}）_`
      : "";
    text += `${formatArtifactImage(previewId, escapeMd(preview.title || safeLabel))}${detected}\n\n`;
  }
  return text;
}

async function fetchImageCollectionReply(plan, userMessage = "") {
  const platforms = resolveImagePlatforms({
    rawMessage: userMessage || plan.displayLabel,
    platforms: plan.platforms,
    preferXhs: plan.preferXiaohongshu,
  });
  const payload = await fetchVerifiedImages(plan.searchQuery, {
    subject: plan.subject,
    intentType: plan.intentType || "materials",
    queryVariants: plan.searchVariants,
    platforms,
    preferXhs: platforms.includes("xiaohongshu") || plan.preferXiaohongshu,
    maxResults: plan.maxImages,
  });
  const images = (payload.results || []).map((row) => ({
    buffer: row.buffer,
    contentType: row.contentType,
    ext: row.ext,
    title: row.title,
    detectedKeywords: row.detectedKeywords,
  }));

  let text;
  if (plan.bundleZip) {
    const { zipId, zipName } = await buildImageCollectionZip(images, plan.displayLabel);
    text = formatCollectionReply({
      images,
      zipId,
      zipName,
      label: plan.displayLabel,
      understanding: payload.understanding,
      verified: payload.verified,
    });
  } else {
    text = formatVerifiedImageReply(payload, plan.displayLabel);
  }
  text += platformHintMessage(platforms);
  text += xiaohongshuCookieHint(platforms.includes("xiaohongshu"), images[0] || {});
  return text;
}

function buildImageSearchVariants(userMessage, subject, query, intentType) {
  const detectedPlatforms = detectImagePlatforms(userMessage);
  if (subject) {
    if (intentType === "materials" || detectedPlatforms.length) {
      return [
        ...buildGeneralSearchVariants(subject, intentType),
        `${subject} 小红书 配图`,
        `${subject} 抖音 宣传图`,
        `${subject} 微信公众号 配图`,
        `${subject} 淘宝 商品主图`,
        `${subject} 美团 配图`,
      ];
    }
    return buildGeneralSearchVariants(subject, intentType);
  }
  return buildSearchQueryVariants(userMessage, query);
}

function buildRegexImageFetchPlan(userMessage) {
  if (!detectImageFetchIntent(userMessage)) return null;

  const wantsZip = wantsImageZipBundle(userMessage);
  const maxImages = resolveImageFetchCount(userMessage);
  const subject = extractImageSubject(userMessage) || "";
  let query = subject
    ? (wantsZip ? `${subject} 宣传配图` : refineImageSearchQuery(userMessage, subject))
    : extractImageQuery(userMessage);
  if (!query) return null;

  query = stripImageSearchNoise(query) || query;
  const intentType =
    wantsZip || /素材包|图包|宣传配图|运营素材/.test(userMessage)
      ? "materials"
      : detectImageIntentType(userMessage);
  const variants = buildImageSearchVariants(userMessage, subject, query, intentType);

  return {
    needsImageFetch: true,
    fetchMode: "collection",
    intentType,
    subject: subject || stripImageSearchNoise(query) || query,
    searchQuery: query,
    searchVariants: [...new Set(variants)].filter((v) => v && v !== query),
    platforms: detectImagePlatforms(userMessage),
    preferXiaohongshu: wantsXiaohongshuImageSource(userMessage),
    rejectHints: wantsZip ? ["微信图标", "平台logo", "模糊", "低清晰度"] : [],
    maxImages,
    bundleZip: wantsZip,
    displayLabel: query,
    understanding: "",
  };
}

async function resolveImageFetchPlan(userMessage, history = []) {
  const regexPlan = buildRegexImageFetchPlan(userMessage);
  const clearRegexIntent = Boolean(regexPlan?.subject && regexPlan.subject.length >= 2);

  if (clearRegexIntent) {
    return regexPlan;
  }

  if (resolveChatConfig()) {
    try {
      const understood = await understandImageFetchRequest(userMessage, history);
      if (understood?.needsImageFetch === false) return null;
      if (understood?.needsImageFetch && understood.searchQuery) return understood;
    } catch {
      // fall back to regex
    }
  }

  return regexPlan;
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

  const wantsZip = wantsImageZipBundle(userMessage);
  const maxImages = resolveImageFetchCount(userMessage);
  const subject = extractImageSubject(userMessage) || "";
  const cleanedQuery = stripImageSearchNoise(q) || q;
  const intentType =
    wantsZip || /素材包|图包|宣传配图|运营素材/.test(userMessage)
      ? "materials"
      : detectImageIntentType(userMessage);
  const variants = buildImageSearchVariants(userMessage, subject, cleanedQuery, intentType);

  const detectedPlatforms = platforms.length ? normalizePlatformIds(platforms) : detectImagePlatforms(userMessage);

  return {
    needsImageFetch: true,
    fetchMode: "collection",
    intentType,
    subject: subject || stripImageSearchNoise(cleanedQuery) || cleanedQuery,
    searchQuery: cleanedQuery,
    searchVariants: [...new Set(variants)].filter((v) => v && v !== cleanedQuery),
    platforms: detectedPlatforms,
    preferXiaohongshu: preferXhs || detectedPlatforms.includes("xiaohongshu"),
    rejectHints: wantsZip ? ["微信图标", "平台logo", "模糊", "低清晰度"] : [],
    maxImages,
    bundleZip: wantsZip,
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
  const normalized = normalizeImageFetchPlan(plan, userMessage);
  const query = normalized.searchQuery;

  if (!imageSearchConfigured() && !DIRECT_IMAGE_URL_RE.test(query)) {
    return formatImageSearchUnavailable();
  }

  try {
    if (DIRECT_IMAGE_URL_RE.test(query)) {
      const fetched = await findAndFetchImageFromUrl(query);
      return formatMultiImageReply({ images: [fetched], label: normalized.displayLabel || "图片" });
    }
    return await fetchImageCollectionReply(normalized, userMessage);
  } catch (e) {
    const subject = stripImageSearchNoise(normalized.subject || query);

    if (e instanceof HttpError) {
      if (
        e.message === "NO_VERIFIED_IMAGES" ||
        e.message === "NO_IMAGE_CANDIDATES" ||
        e.statusCode === 404
      ) {
        return formatImageSearchNotFound(subject || normalized.subject || query, {
          intentType: normalized.intentType,
        });
      }
      return toUserFacingErrorMessage(e.message);
    }

    return formatImageSearchNotFound(subject || normalized.subject || query);
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
