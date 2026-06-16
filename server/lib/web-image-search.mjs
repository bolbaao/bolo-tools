import { HttpError } from "./http-error.mjs";
import { collectImageCandidates, fetchRemoteImage, imageSearchConfigured } from "./image-search.mjs";
import { IMAGE_PLATFORMS } from "./platform-image-search.mjs";
import {
  buildGeneralSearchVariants,
  buildStoreSearchQueries,
  extractSearchKeywords,
  isStoreLikeSubject,
  stripImageSearchNoise,
  textMatchesSearchKeywords,
  titleMatchesSubject,
} from "./image-search-query.mjs";
import { verifyImageForWebSearch } from "./media-verify.mjs";
import { photoVisionConfigured } from "./photo-vision.mjs";
import { formatImageNotFound } from "../../shared/public-error.mjs";

const CN_REGION = { id: "cn", label: "中国", gl: "cn", hl: "zh-cn", tavilyCountry: "china" };
const VERIFY_CONCURRENCY = 4;
const MAX_VERIFY_ATTEMPTS = 32;

export function webImageSearchReady() {
  return imageSearchConfigured();
}

function platformLabel(source, domain) {
  if (source && IMAGE_PLATFORMS[source]?.label) return IMAGE_PLATFORMS[source].label;
  const host = String(domain || "").replace(/^www\./, "");
  return host || undefined;
}

function toImageResult(item, fetched, verifyMeta = {}) {
  const imageUrl = String(item.url || "").trim();
  if (!imageUrl) return null;
  const pageUrl = String(item.pageUrl || "").trim();
  const title = String(item.title || "").trim() || "图片";
  const domain = String(item.domain || "").trim();
  const detected = Array.isArray(verifyMeta.detectedKeywords)
    ? verifyMeta.detectedKeywords.filter(Boolean)
    : [];
  const snippetParts = [domain ? `${domain} · 图片` : "图片"];
  if (detected.length) snippetParts.push(`识别：${detected.slice(0, 4).join("、")}`);
  if (verifyMeta.verified) snippetParts.push("已校验");

  return {
    title,
    url: pageUrl || imageUrl,
    snippet: snippetParts.join(" · "),
    imageUrl,
    thumbnailUrl: imageUrl,
    platform: item.source,
    platformLabel: platformLabel(item.source, domain),
    score: item.score,
    verified: Boolean(verifyMeta.verified),
    detectedKeywords: detected.length ? detected : undefined,
    buffer: fetched.buffer,
    contentType: fetched.contentType,
    ext: fetched.ext,
    sourceUrl: pageUrl || imageUrl,
  };
}

function buildVerifyQuery(core, intentType) {
  const q = String(core || "").trim();
  if (!q) return q;
  if (intentType === "poster" && !/海报|宣传|主视觉/i.test(q)) return `${q} 产品海报`;
  if (intentType === "logo" && !/logo|标志|商标|图标/i.test(q)) return `${q} logo`;
  return q;
}

function buildSearchQueries(core, opts = {}) {
  const intentType = opts.intentType || "general";
  const variants = Array.isArray(opts.queryVariants) ? opts.queryVariants : [];
  const fromIntent = buildGeneralSearchVariants(core, intentType);
  const storeQueries = isStoreLikeSubject(core) ? buildStoreSearchQueries(core) : [];
  return [...new Set([core, ...variants, ...fromIntent, ...storeQueries].map(stripImageSearchNoise).filter(Boolean))];
}

function candidateMatchesQuery(item, core) {
  const hay = `${item.title || ""} ${item.pageUrl || ""} ${item.domain || ""}`;
  return titleMatchesSubject(item.title || "", core) || textMatchesSearchKeywords(hay, core);
}

async function collectSearchCandidates(core, poolSize, opts = {}) {
  const queries = buildSearchQueries(core, opts).slice(0, 8);
  const seen = new Set();
  const merged = [];
  const platforms = Array.isArray(opts.platforms) ? opts.platforms : [];
  const preferXhs = Boolean(opts.preferXhs) || platforms.includes("xiaohongshu");

  for (const q of queries) {
    if (merged.length >= poolSize) break;
    const batch = await collectImageCandidates(q, {
      maxCandidates: Math.max(8, Math.ceil(poolSize / queries.length)),
      autoDiscovery: platforms.length === 0,
      platforms,
      preferXhs,
      intentType: opts.intentType || "general",
      subject: opts.subject || core,
    });
    for (const item of batch) {
      const key = String(item.url || "").split("?")[0];
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
      if (merged.length >= poolSize) break;
    }
  }

  merged.sort((a, b) => (b.score || 0) - (a.score || 0));
  return merged;
}

async function tryVerifyCandidate(item, verifyQuery) {
  try {
    const fetched = await fetchRemoteImage(item.url);
    const check = await verifyImageForWebSearch({
      buffer: fetched.buffer,
      contentType: fetched.contentType,
      query: verifyQuery,
      platformMeta: item,
    });
    if (!check.match) return null;
    return toImageResult(item, fetched, {
      verified: photoVisionConfigured(),
      detectedKeywords: check.detectedKeywords,
    });
  } catch {
    return null;
  }
}

async function verifyCandidates(candidates, verifyQuery, maxResults) {
  const pool = candidates
    .filter((item) => candidateMatchesQuery(item, verifyQuery))
    .slice(0, MAX_VERIFY_ATTEMPTS);

  const results = [];
  const seen = new Set();

  for (let i = 0; i < pool.length && results.length < maxResults; i += VERIFY_CONCURRENCY) {
    const chunk = pool.slice(i, i + VERIFY_CONCURRENCY);
    const settled = await Promise.all(chunk.map((item) => tryVerifyCandidate(item, verifyQuery)));
    for (const row of settled) {
      if (!row) continue;
      const key = row.imageUrl.split("?")[0];
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(row);
      if (results.length >= maxResults) break;
    }
  }

  return results;
}

function visionNote() {
  return photoVisionConfigured() ? "识图校验" : "关键词校验";
}

/**
 * 豆包式图片检索：理解关键词 → 全网候选 → 识图/关键词校验，仅返回画面一致的图片
 * @param {string} query
 * @param {{
 *   maxResults?: number,
 *   subject?: string,
 *   intentType?: string,
 *   queryVariants?: string[],
 *   platforms?: string[],
 *   preferXhs?: boolean,
 * }} opts
 */
export async function fetchVerifiedImages(query, opts = {}) {
  const keyword = String(query || "").trim();
  if (!keyword) {
    throw new HttpError(400, "请说明要找什么图片");
  }
  if (!webImageSearchReady()) {
    throw new HttpError(503, "图片搜索暂不可用，请稍后再试。如需开通请联系客服。");
  }

  const core = stripImageSearchNoise(opts.subject || keyword) || keyword;
  const verifyQuery = buildVerifyQuery(core, opts.intentType);
  const maxResults = Math.min(24, Math.max(1, Number(opts.maxResults) || 4));
  const poolSize = Math.min(MAX_VERIFY_ATTEMPTS, maxResults * 6);

  const candidates = await collectSearchCandidates(core, poolSize, opts);
  const results = await verifyCandidates(candidates, verifyQuery, maxResults);

  if (!results.length) {
    throw new HttpError(404, "NO_VERIFIED_IMAGES");
  }

  const { keywords } = extractSearchKeywords(core);
  return {
    query: keyword,
    searchQuery: core,
    verifyQuery,
    searchVariants: keywords.length ? keywords : [core],
    understanding: `检索「${core}」，通过${visionNote()}仅保留画面与主题一致的图片`,
    results,
    verified: photoVisionConfigured(),
  };
}

/**
 * 全网图片检索（AI 搜索页）
 * @param {string} query
 * @param {{ maxResults?: number }} opts
 */
export async function searchWebImages(query, opts = {}) {
  const keyword = String(query || "").trim();
  if (!keyword) {
    return { query: "", searchQuery: "", results: [], provider: "image", mode: "images" };
  }

  const maxResults = Math.min(24, Math.max(6, Number(opts.maxResults) || 16));
  const payload = await fetchVerifiedImages(keyword, { maxResults, intentType: "general" });

  return {
    query: keyword,
    searchQuery: payload.searchQuery,
    searchVariants: payload.searchVariants,
    understanding: payload.understanding,
    results: payload.results.map(({ buffer, contentType, ext, sourceUrl, ...rest }) => rest),
    provider: "image",
    topic: "general",
    planned: false,
    mode: "images",
    modeLabel: "图片搜索",
    region: CN_REGION,
    recencyIntent: false,
    queriesUsed: [payload.searchQuery],
    verified: payload.verified,
  };
}

export function formatImageSearchNotFound(query, opts = {}) {
  const core = stripImageSearchNoise(query) || query;
  const vision = photoVisionConfigured();
  const base = formatImageNotFound(core);
  const hint = vision
    ? `\n\n已用识图模型逐张校验，未找到与「${core}」画面一致的图片。可尝试：\n- 更具体的关键词（如品牌名 + 海报/门店/产品）\n- 指定平台：小红书、抖音、微信公众号\n- 直接粘贴图片链接\n- 说「帮我画一张…」用 AI 生成`
    : `\n\n未找到通过校验的图片。请换关键词、粘贴图片链接，或说「帮我画一张…」用 AI 生成。`;
  return base + hint;
}
