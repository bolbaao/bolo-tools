import { HttpError } from "./http-error.mjs";
import { collectImageCandidates, fetchRemoteImage, imageSearchConfigured } from "./image-search.mjs";
import { IMAGE_PLATFORMS } from "./platform-image-search.mjs";
import {
  buildStoreSearchQueries,
  extractSearchKeywords,
  isStoreLikeSubject,
  matchedSearchKeywords,
  stripImageSearchNoise,
  textMatchesSearchKeywords,
  titleMatchesSubject,
} from "./image-search-query.mjs";
import { verifyImageForWebSearch } from "./media-verify.mjs";
import { photoVisionConfigured } from "./photo-vision.mjs";
import { formatImageNotFound } from "../../shared/public-error.mjs";

const CN_REGION = { id: "cn", label: "中国", gl: "cn", hl: "zh-cn", tavilyCountry: "china" };
const VERIFY_CONCURRENCY = 3;
const MAX_VERIFY_ATTEMPTS = 24;

export function webImageSearchReady() {
  return imageSearchConfigured();
}

function platformLabel(source, domain) {
  if (source && IMAGE_PLATFORMS[source]?.label) return IMAGE_PLATFORMS[source].label;
  const host = String(domain || "").replace(/^www\./, "");
  return host || undefined;
}

function toImageResult(item, verifyMeta = {}) {
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
  };
}

async function tryVerifyCandidate(item, core) {
  try {
    const fetched = await fetchRemoteImage(item.url);
    const check = await verifyImageForWebSearch({
      buffer: fetched.buffer,
      contentType: fetched.contentType,
      query: core,
      platformMeta: item,
    });
    if (!check.match) return null;
    return toImageResult(item, {
      verified: photoVisionConfigured(),
      detectedKeywords: check.detectedKeywords,
    });
  } catch {
    return null;
  }
}

function candidateMatchesQuery(item, core) {
  const hay = `${item.title || ""} ${item.pageUrl || ""} ${item.domain || ""}`;
  return titleMatchesSubject(item.title || "", core) || textMatchesSearchKeywords(hay, core);
}

async function collectSearchCandidates(core, poolSize) {
  const queries = isStoreLikeSubject(core) ? buildStoreSearchQueries(core) : [core];
  const seen = new Set();
  const merged = [];

  for (const q of queries) {
    if (merged.length >= poolSize) break;
    const batch = await collectImageCandidates(q, {
      maxCandidates: poolSize,
      autoDiscovery: true,
      intentType: "general",
      subject: core,
    });
    for (const item of batch) {
      const key = String(item.url || "").split("?")[0];
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
      if (merged.length >= poolSize) break;
    }
  }

  return merged;
}

async function verifyCandidates(candidates, core, maxResults) {
  const pool = candidates
    .filter((item) => candidateMatchesQuery(item, core))
    .slice(0, MAX_VERIFY_ATTEMPTS);

  const results = [];
  const seen = new Set();

  for (let i = 0; i < pool.length && results.length < maxResults; i += VERIFY_CONCURRENCY) {
    const chunk = pool.slice(i, i + VERIFY_CONCURRENCY);
    const settled = await Promise.all(chunk.map((item) => tryVerifyCandidate(item, core)));
    for (const row of settled) {
      if (!row) continue;
      const key = row.imageUrl.split("?")[0];
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(row);
      if (results.length >= maxResults) break;
    }
  }

  if (!results.length && pool.length && isStoreLikeSubject(core)) {
    for (const item of pool.slice(0, maxResults)) {
      const key = String(item.url || "").split("?")[0];
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(
        toImageResult(item, {
          verified: false,
          detectedKeywords: matchedSearchKeywords(`${item.title || ""} ${item.pageUrl || ""}`, core),
        }),
      );
    }
  }

  return results;
}

/**
 * 全网图片检索：提取关键词 → 候选检索 → 识图校验，仅返回画面与关键词一致的图片
 * @param {string} query
 * @param {{ maxResults?: number }} opts
 */
export async function searchWebImages(query, opts = {}) {
  const keyword = String(query || "").trim();
  if (!keyword) {
    return { query: "", searchQuery: "", results: [], provider: "image", mode: "images" };
  }
  if (!webImageSearchReady()) {
    throw new HttpError(503, "图片搜索暂不可用，请稍后再试。如需开通请联系客服。");
  }

  const core = stripImageSearchNoise(keyword) || keyword;
  const { keywords } = extractSearchKeywords(core);
  const maxResults = Math.min(24, Math.max(6, Number(opts.maxResults) || 16));
  const poolSize = Math.min(MAX_VERIFY_ATTEMPTS, maxResults * 3);

  const candidates = await collectSearchCandidates(core, poolSize);

  const results = await verifyCandidates(candidates, core, maxResults);
  if (!results.length) {
    throw new HttpError(422, formatImageNotFound(keyword));
  }

  const visionNote = photoVisionConfigured() ? "识图校验" : "关键词校验";
  return {
    query: keyword,
    searchQuery: core,
    searchVariants: keywords.length ? keywords : [core],
    understanding: `在全网检索「${core}」，并通过${visionNote}仅保留与关键词一致的图片`,
    results,
    provider: "image",
    topic: "general",
    planned: false,
    mode: "images",
    modeLabel: "图片搜索",
    region: CN_REGION,
    recencyIntent: false,
    queriesUsed: [core],
    verified: photoVisionConfigured(),
  };
}
