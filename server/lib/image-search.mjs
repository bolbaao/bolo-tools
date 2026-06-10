import * as cheerio from "cheerio";
import { env } from "./env.mjs";
import { HttpError } from "./http-error.mjs";
import { assertPublicHttpUrlResolved } from "./url-guard.mjs";
import { searchWeb } from "./web-search.mjs";
import {
  buildMediaVerifyBrief,
  isPlatformMediaSource,
  mediaVerifyEnabled,
  verifyImageAgainstBrief,
} from "./media-verify.mjs";
import {
  searchMultiPlatformImages,
  searchDouyinImages,
  detectImagePlatforms,
  normalizePlatformIds,
  platformReferer,
  IMAGE_PLATFORMS,
} from "./platform-image-search.mjs";
import {
  searchXiaohongshuImages,
  xiaohongshuImageSearchReady,
} from "./xiaohongshu-image-search.mjs";
import { expandImageSearchVariants, stripImageSearchNoise, coreSubjectTokens, titleMatchesSubject, platformSearchKeyword } from "./image-search-query.mjs";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export function imageSearchConfigured() {
  return Boolean(
    env("SERPER_API_KEY") || env("TAVILY_API_KEY") || xiaohongshuImageSearchReady(),
  );
}

export { detectImagePlatforms, normalizePlatformIds, IMAGE_PLATFORMS };

export function xiaohongshuImageSearchAvailable() {
  return xiaohongshuImageSearchReady();
}

function extFromContentType(contentType) {
  const ct = String(contentType || "").toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  return "png";
}

function normalizeCandidate(url, meta = {}) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return {
      url: parsed.toString(),
      title: String(meta.title || "").trim(),
      pageUrl: String(meta.pageUrl || meta.link || "").trim() || undefined,
      domain: String(meta.domain || parsed.hostname || "").trim(),
      score: Number(meta.score) || 0,
    };
  } catch {
    return null;
  }
}

function resolvePreferredPlatforms(meta = {}) {
  const fromOpts = normalizePlatformIds(meta.platforms || []);
  if (fromOpts.length) return fromOpts;
  if (meta.preferXhs) return ["xiaohongshu"];
  return [];
}

function scoreCandidate(candidate, query, meta = {}) {
  let score = candidate.score || 0;
  const q = String(query || "").toLowerCase();
  const title = `${candidate.title || ""} ${candidate.domain || ""}`.toLowerCase();
  const haystack = `${candidate.domain || ""} ${candidate.url || ""} ${candidate.pageUrl || ""} ${candidate.source || ""}`;
  const preferred = resolvePreferredPlatforms(meta);

  if (/logo|标志|商标|icon|brand|wikimedia|wikipedia/.test(title)) {
    score += meta.intentType === "logo" ? 4 : -6;
  }
  if (/\.(png|webp|jpe?g|gif)(\?|$)/i.test(candidate.url)) score += 2;
  if (/logo|标志|商标|icon/i.test(q) && /logo|标志|商标|icon/.test(title)) score += 3;
  const tokens = q.replace(/logo|标志|商标|图标|icon/gi, "").split(/\s+/).filter((t) => t.length >= 2);
  for (const token of tokens) {
    if (title.includes(token.toLowerCase())) score += 2;
  }
  const { primary } = coreSubjectTokens(q);
  if (primary && primary.length >= 2 && /[\u4e00-\u9fff]/.test(primary)) {
    if (title.includes(primary.toLowerCase())) score += 8;
    else if (meta.intentType !== "poster") score -= 10;
  }
  if (/pinimg|alicdn|qhimg|bdstatic|googleusercontent|gstatic/.test(candidate.domain || "")) score += 1;
  const titleHay = `${candidate.title || ""} ${candidate.pageUrl || ""}`.toLowerCase();
  if (/排行榜|榜单|top\s*\d|截图|商品列表|热卖榜|畅销榜/.test(titleHay)) score -= 8;
  if (/海报|宣传|官方|产品图|主视觉/.test(titleHay)) score += 3;
  if (preferred.includes("xiaohongshu") && /海报|宣传/.test(String(query || ""))) score += 2;
  if (meta.intentType === "poster" && /海报|宣传|官方|产品图|主视觉/.test(titleHay)) score += 4;
  if (meta.intentType === "poster" && /排行榜|榜单|截图|商品列表/.test(titleHay)) score -= 12;
  if ((meta.intentType === "materials" || meta.intentType === "general") && /微信图标|wechat\s*icon|app\s*icon|favicon/.test(titleHay)) {
    score -= 15;
  }
  if (meta.intentType === "materials" && /高清|宣传|配图|海报|素材/.test(titleHay)) score += 3;

  for (const platformId of Object.keys(IMAGE_PLATFORMS)) {
    const cfg = IMAGE_PLATFORMS[platformId];
    if (!cfg?.domains?.test(haystack)) continue;
    candidate.source = candidate.source || platformId;
    score += 4;
    if (preferred.includes(platformId)) score += 8;
  }

  return score;
}

function withPlatformHint(query, platforms = []) {
  const q = String(query || "").trim();
  if (!platforms.length) return q;
  const hints = platforms
    .map((id) => IMAGE_PLATFORMS[id]?.searchHint)
    .filter(Boolean)
    .filter((h) => !q.includes(h));
  if (!hints.length) return q;
  return `${q} ${hints[0]}`;
}

async function searchSerperImages(query, maxResults = 8, platforms = []) {
  const q = withPlatformHint(query, platforms);
  const apiKey = env("SERPER_API_KEY");
  if (!apiKey) return [];

  let data;
  try {
    const res = await fetch("https://google.serper.dev/images", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        q: q,
        num: Math.min(12, Math.max(3, maxResults)),
      }),
      signal: AbortSignal.timeout(15000),
    });
    data = await res.json().catch(() => ({}));
    if (!res.ok) return [];
  } catch {
    return [];
  }

  return (data.images || [])
    .map((item) =>
      normalizeCandidate(item.imageUrl || item.thumbnailUrl, {
        title: item.title,
        pageUrl: item.link,
        domain: item.domain,
        score: 2,
      }),
    )
    .filter(Boolean);
}

async function searchWikipediaThumb(query) {
  const title = String(query || "")
    .replace(/\s*(logo|标志|商标|图标|icon)\s*/gi, " ")
    .trim();
  if (!title) return [];

  const out = [];
  for (const lang of ["zh", "en"]) {
    try {
      const res = await fetch(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
        {
          headers: { Accept: "application/json", "User-Agent": UA },
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!res.ok) continue;
      const data = await res.json();
      const thumb = data?.thumbnail?.source;
      const full = data?.originalimage?.source;
      const candidate = normalizeCandidate(full || thumb, {
        title: data?.title || title,
        pageUrl: data?.content_urls?.desktop?.page,
        domain: `${lang}.wikipedia.org`,
        score: 5,
      });
      if (candidate) out.push(candidate);
    } catch {
      /* try next lang */
    }
  }
  return out;
}

async function extractOgImageFromPage(pageUrl) {
  const safe = await assertPublicHttpUrlResolved(pageUrl);
  const res = await fetch(safe, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const html = await res.text();
  const $ = cheerio.load(html);
  const og =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    $('link[rel="image_src"]').attr("href");
  if (!og) return null;
  try {
    return normalizeCandidate(new URL(og, safe).href, {
      title: $("title").first().text().trim(),
      pageUrl: safe,
      score: 1,
    });
  } catch {
    return null;
  }
}

async function searchWebPageImages(query, platforms = []) {
  try {
    const platformHint = platforms.length
      ? platforms.map((id) => IMAGE_PLATFORMS[id]?.searchHint).filter(Boolean).join(" ")
      : "抖音 小红书 淘宝 美团 微信公众号";
    const hint = `${query} ${platformHint}`.trim();
    const payload = await searchWeb(hint, { depth: "basic", maxResults: 5 });
    const out = [];
    for (const item of payload.results || []) {
      const og = await extractOgImageFromPage(item.url);
      if (og) out.push(og);
    }
    return out;
  } catch {
    return [];
  }
}

export async function collectImageCandidates(query, opts = {}) {
  const q = stripImageSearchNoise(query);
  if (!q) return [];
  const platformKw = platformSearchKeyword(q, opts.subject);
  const { platforms, autoDiscovery } = resolveEffectivePlatforms(opts);
  const preferXhs =
    platforms.includes("xiaohongshu") || Boolean(opts.preferXhs) || autoDiscovery;
  const nativePlatforms = platforms.filter((id) => id !== "xiaohongshu");
  const searchDouyin = nativePlatforms.includes("douyin") || autoDiscovery;

  const buckets = await Promise.all([
    preferXhs ? searchXiaohongshuImages(platformKw || q) : Promise.resolve([]),
    nativePlatforms.length
      ? searchMultiPlatformImages(platformKw || q, nativePlatforms.filter((id) => id !== "douyin"))
      : Promise.resolve([]),
    searchDouyin ? searchDouyinImages(platformKw || q, opts.subject) : Promise.resolve([]),
    searchSerperImages(q, 8, platforms),
    preferXhs || platforms.length ? Promise.resolve([]) : searchWikipediaThumb(q),
    imageSearchConfigured() || preferXhs || platforms.length || autoDiscovery
      ? searchWebPageImages(platformKw || q, platforms.length ? platforms : AUTO_DISCOVERY_PLATFORMS)
      : Promise.resolve([]),
  ]);

  const seen = new Set();
  const merged = [];
  for (const list of buckets) {
    for (const item of list) {
      const key = item.url.split("?")[0];
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push({
        ...item,
        score: scoreCandidate(item, q, {
          preferXhs,
          platforms,
          intentType: opts.intentType,
        }),
      });
    }
  }

  merged.sort((a, b) => b.score - a.score);
  const limit = Number(opts.maxCandidates) > 0 ? opts.maxCandidates : 12;
  return merged.slice(0, limit);
}

const MIN_HD_BYTES = 35_000;
/** 用户未指定平台时，默认检索的中文内容平台 */
const AUTO_DISCOVERY_PLATFORMS = ["douyin", "xiaohongshu", "wechat"];

function resolveEffectivePlatforms(opts = {}) {
  const explicit = resolvePreferredPlatforms(opts);
  if (explicit.length) return { platforms: explicit, autoDiscovery: false };
  if (opts.autoDiscovery === false) return { platforms: [], autoDiscovery: false };
  return { platforms: AUTO_DISCOVERY_PLATFORMS, autoDiscovery: true };
}

function resolveMaxImages(opts = {}) {
  const n = Number(opts.maxImages);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return Number(env("IMAGE_FETCH_MAX_IMAGES", "30")) || 30;
}

async function fetchBestUnverifiedImage(ordered, opts = {}) {
  for (const item of ordered) {
    try {
      const fetched = await fetchRemoteImage(item.url);
      if (isLikelyLowQuality(fetched.buffer, item, opts)) continue;
      return {
        ...fetched,
        title: item.title || opts.query || "",
        sourceUrl: item.pageUrl || item.url,
        verified: false,
      };
    } catch {
      // try next candidate
    }
  }
  return null;
}

function isLikelyLowQuality(buffer, meta = {}, opts = {}) {
  const minBytes = opts.intentType === "logo" ? 8_000 : 20_000;
  if (!buffer || buffer.length < minBytes) return true;
  const hay = `${meta.title || ""} ${meta.pageUrl || ""} ${meta.domain || ""}`.toLowerCase();
  if (/微信图标|wechat\s*icon|app\s*icon|favicon|platform\s*logo|logo\s*icon/.test(hay)) return true;
  if (/排行榜|榜单|商品列表|商城截图/.test(hay)) return true;
  const subject = opts.subject || opts.query || "";
  if (subject && meta.title && !titleMatchesSubject(meta.title, subject)) return true;
  const rejects = Array.isArray(opts.rejectHints) ? opts.rejectHints : [];
  for (const hint of rejects) {
    const h = String(hint || "").trim().toLowerCase();
    if (h.length >= 2 && hay.includes(h)) return true;
  }
  return false;
}

/**
 * 批量检索并校验图片（用于素材包）
 */
export async function findVerifiedImageBatch(query, opts = {}) {
  const maxImages = resolveMaxImages(opts);
  const variants = expandImageSearchVariants(query, opts);
  const uniqueVariants = [...new Set(variants.map((q) => String(q).trim()).filter(Boolean))];

  const verify = opts.verify !== false && mediaVerifyEnabled();
  const brief = verify
    ? await buildMediaVerifyBrief(query, "image", { intentType: opts.intentType || "materials" })
    : null;

  const seen = new Set();
  const results = [];
  let lastVerifyReason = null;

  for (const q of uniqueVariants) {
    if (results.length >= maxImages) break;
    const candidates = await collectImageCandidates(q, {
      ...opts,
      maxCandidates: 20,
    });
    const ordered = orderCandidatesForVerify(candidates, true);

    for (const item of ordered) {
      if (results.length >= maxImages) break;
      const key = item.url.split("?")[0];
      if (seen.has(key)) continue;

      try {
        const fetched = await fetchRemoteImage(item.url);
        if (isLikelyLowQuality(fetched.buffer, item, opts)) continue;

        if (verify && brief) {
          const check = await verifyImageAgainstBrief({
            buffer: fetched.buffer,
            contentType: fetched.contentType,
            brief,
            query: opts.subject || query,
            platformMeta: item,
          });
          if (!check.match) {
            lastVerifyReason = check.reason;
            continue;
          }
        }

        seen.add(key);
        results.push({
          ...fetched,
          title: item.title || q,
          sourceUrl: item.pageUrl || item.url,
          verified: Boolean(verify && brief),
        });
      } catch {
        // try next candidate
      }
    }
  }

  if (!results.length) {
    for (const q of uniqueVariants) {
      if (results.length >= maxImages) break;
      const candidates = await collectImageCandidates(q, {
        ...opts,
        maxCandidates: 20,
      });
      const ordered = orderCandidatesForVerify(candidates, true);

      for (const item of ordered) {
        if (results.length >= maxImages) break;
        const key = item.url.split("?")[0];
        if (seen.has(key)) continue;
        try {
          const fetched = await fetchRemoteImage(item.url);
          if (isLikelyLowQuality(fetched.buffer, item, opts)) continue;
          seen.add(key);
          results.push({
            ...fetched,
            title: item.title || q,
            sourceUrl: item.pageUrl || item.url,
            verified: false,
          });
        } catch {
          // try next candidate
        }
      }
    }
  }

  if (!results.length) {
    throw new HttpError(422, lastVerifyReason || "NO_VERIFIED_IMAGES");
  }

  return results;
}

/**
 * @param {string} url
 */
function imageFetchHeaders(url) {
  const headers = { "User-Agent": UA, Accept: "image/*,*/*;q=0.8" };
  const referer = platformReferer(url);
  if (referer) {
    headers.Referer = referer;
    if (/xiaohongshu/i.test(referer)) headers.Origin = referer.replace(/\/$/, "");
  }
  return headers;
}

export async function fetchRemoteImage(url) {
  const safe = await assertPublicHttpUrlResolved(url);
  const res = await fetch(safe, {
    headers: imageFetchHeaders(safe),
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new HttpError(502, `图片下载失败（HTTP ${res.status}）`);
  }

  const contentType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new HttpError(422, "链接不是可用的图片格式");
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (!buffer.length) throw new HttpError(422, "图片为空");
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new HttpError(413, "图片过大，请换一张或缩小尺寸");
  }

  return {
    buffer,
    contentType,
    ext: extFromContentType(contentType),
  };
}

/**
 * @param {string} query
 */
function orderCandidatesForVerify(candidates, preferPlatform) {
  const platform = candidates.filter((c) => isPlatformMediaSource(c));
  const general = candidates.filter((c) => !isPlatformMediaSource(c));
  if (preferPlatform && platform.length) return [...platform, ...general];
  return candidates;
}

async function findAndFetchImageOnce(query, opts = {}) {
  const candidates = await collectImageCandidates(query, opts);
  if (!candidates.length) {
    throw new HttpError(404, "NO_IMAGE_CANDIDATES");
  }

  const verify = opts.verify !== false && mediaVerifyEnabled();
  const brief = verify
    ? await buildMediaVerifyBrief(query, "image", { intentType: opts.intentType })
    : null;
  const ordered = orderCandidatesForVerify(candidates, true);

  let lastError = null;
  let lastVerifyReason = null;

  for (const item of ordered) {
    try {
      const fetched = await fetchRemoteImage(item.url);
      const qualityOpts = { ...opts, query, subject: opts.subject || query };
      if (isLikelyLowQuality(fetched.buffer, item, qualityOpts)) continue;
      if (verify && brief) {
        const check = await verifyImageAgainstBrief({
          buffer: fetched.buffer,
          contentType: fetched.contentType,
          brief,
          query,
          platformMeta: item,
        });
        if (!check.match) {
          lastVerifyReason = check.reason;
          continue;
        }
        return {
          ...fetched,
          title: item.title || query,
          sourceUrl: item.pageUrl || item.url,
          verified: true,
          verifyReason: check.reason,
        };
      }
      return {
        ...fetched,
        title: item.title || query,
        sourceUrl: item.pageUrl || item.url,
      };
    } catch (e) {
      lastError = e;
    }
  }

  if (verify && brief) {
    const fallback = await fetchBestUnverifiedImage(ordered, { ...opts, query });
    if (fallback) return fallback;
    throw new HttpError(422, lastVerifyReason || "VERIFY_FAILED");
  }

  const msg =
    lastError instanceof HttpError
      ? lastError.message
      : lastError?.message || "图片下载失败";
  throw new HttpError(502, msg);
}

export async function findAndFetchImage(query, opts = {}) {
  const cleaned = stripImageSearchNoise(query);
  const variants = expandImageSearchVariants(cleaned || query, opts);
  const unique = [...new Set(variants.map((q) => String(q).trim()).filter(Boolean))];

  let lastError = null;
  for (const q of unique) {
    try {
      return await findAndFetchImageOnce(q, { ...opts, subject: opts.subject || cleaned || query });
    } catch (e) {
      lastError = e;
      if (e instanceof HttpError && e.statusCode === 404) continue;
      if (e instanceof HttpError && e.statusCode === 422) continue;
      throw e;
    }
  }

  if (lastError instanceof HttpError) throw lastError;
  throw new HttpError(404, "NO_IMAGE_CANDIDATES");
}
