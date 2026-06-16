import * as cheerio from "cheerio";
import { fetchWithProxyFallback } from "./fetch-helper.mjs";
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
  searchWechatOfficialImages,
  detectImagePlatforms,
  normalizePlatformIds,
  platformReferer,
  IMAGE_PLATFORMS,
  searchSerperImages,
  normalizeImageCandidate,
} from "./platform-image-search.mjs";
import {
  searchXiaohongshuImages,
  xiaohongshuImageSearchReady,
} from "./xiaohongshu-image-search.mjs";
import {
  expandImageSearchVariants,
  stripImageSearchNoise,
  coreSubjectTokens,
  titleMatchesSubject,
  platformSearchKeyword,
  isHotelLikeSubject,
  buildHotelEnglishVariants,
  isStoreLikeSubject,
} from "./image-search-query.mjs";

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
  if (isHotelLikeSubject(meta.subject || q)) {
    if (/hilton|marriott|hyatt|ihg|accor|ctrip|trip\.com|meituan|dianping|booking|hotels\.com/i.test(haystack)) {
      score += 10;
    }
    if (/外观|外景|实景|酒店|hotel/i.test(titleHay)) score += 4;
    if (/套餐|团购|优惠券|三日游|线路\)/.test(titleHay)) score -= 6;
  }
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
      const candidate = normalizeImageCandidate(full || thumb, {
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
  const res = await fetchWithProxyFallback(safe, {
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
    return normalizeImageCandidate(new URL(og, safe).href, {
      title: $("title").first().text().trim(),
      pageUrl: safe,
      score: 1,
    });
  } catch {
    return null;
  }
}

/** 酒店 / 门店：全网检索官网与旅游平台配图 */
async function searchHotelWebImages(subject) {
  const core = platformSearchKeyword(subject, subject);
  if (!core || !isHotelLikeSubject(core)) return [];

  const queries = [
    `${core}酒店 外观 实景`,
    `${core}酒店 外景`,
    `site:ctrip.com ${core}`,
    `site:meituan.com ${core}酒店`,
    ...buildHotelEnglishVariants(core).map((en) => `${en} hotel exterior`),
  ];

  const out = [];
  const seen = new Set();
  for (const q of [...new Set(queries)].slice(0, 6)) {
    try {
      const payload = await searchWeb(q, { depth: "basic", maxResults: 4 });
      for (const item of payload.results || []) {
        const og = await extractOgImageFromPage(item.url);
        if (!og) continue;
        const key = og.url.split("?")[0];
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ ...og, score: (og.score || 1) + 6, source: "hotel-web" });
      }
    } catch {
      /* try next query */
    }
  }
  return out;
}

/** 门店 / KTV / 餐饮：优先微信公众号搜狗检索 */
async function searchBrandStoreImages(subject) {
  const core = platformSearchKeyword(subject, subject);
  if (!core || !isStoreLikeSubject(core)) return [];

  const out = [];
  const seen = new Set();
  for (const item of await searchWechatOfficialImages(core)) {
    const key = item.url.split("?")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...item, score: (item.score || 0) + 8, source: item.source || "wechat" });
  }
  return out;
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

  const hotelSubject = opts.subject || q;
  const buckets = await Promise.all([
    preferXhs ? searchXiaohongshuImages(platformKw || q) : Promise.resolve([]),
    nativePlatforms.length
      ? searchMultiPlatformImages(platformKw || q, nativePlatforms.filter((id) => id !== "douyin"))
      : Promise.resolve([]),
    searchDouyin ? searchDouyinImages(platformKw || q, opts.subject) : Promise.resolve([]),
    searchSerperImages(withPlatformHint(q, platforms), { maxResults: 8, score: 2 }),
    searchWikipediaThumb(platformKw || q),
    isHotelLikeSubject(hotelSubject) ? searchHotelWebImages(hotelSubject) : Promise.resolve([]),
    isStoreLikeSubject(hotelSubject) ? searchBrandStoreImages(hotelSubject) : Promise.resolve([]),
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
          subject: opts.subject || q,
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

function shouldEnforceTitleMatch(opts = {}) {
  const intent = opts.intentType || "general";
  if (intent === "poster" || intent === "logo" || intent === "materials") return true;
  const subject = String(opts.subject || opts.query || "");
  if (isHotelLikeSubject(subject) || isStoreLikeSubject(subject)) return true;
  if (/ktv|KTV|酒吧|餐厅|咖啡|奶茶|门店|店/i.test(subject)) return true;
  return false;
}

function isLikelyLowQuality(buffer, meta = {}, opts = {}) {
  const minBytes = opts.intentType === "logo" ? 8_000 : 20_000;
  if (!buffer || buffer.length < minBytes) return true;
  const hay = `${meta.title || ""} ${meta.pageUrl || ""} ${meta.domain || ""}`.toLowerCase();
  if (/微信图标|wechat\s*icon|app\s*icon|favicon|platform\s*logo|logo\s*icon/.test(hay)) return true;
  if (/排行榜|榜单|商品列表|商城截图/.test(hay)) return true;
  const subject = opts.subject || opts.query || "";
  if (subject && meta.title && !titleMatchesSubject(meta.title, subject)) {
    if (shouldEnforceTitleMatch(opts)) {
      if (!isHotelLikeSubject(subject)) return true;
      const { primary } = coreSubjectTokens(subject);
      const hay = `${meta.title || ""}`.toLowerCase();
      if (primary && primary.length >= 4 && !hay.includes(primary.slice(0, 4).toLowerCase())) return true;
    }
  }
  const rejects = Array.isArray(opts.rejectHints) ? opts.rejectHints : [];
  for (const hint of rejects) {
    const h = String(hint || "").trim().toLowerCase();
    if (h.length >= 2 && hay.includes(h)) return true;
  }
  return false;
}

const BATCH_FETCH_CONCURRENCY = 4;

async function tryFetchOneCandidate(item, q, opts, verify, brief, query) {
  try {
    const fetched = await fetchRemoteImage(item.url);
    if (isLikelyLowQuality(fetched.buffer, item, opts)) return null;
    if (verify && brief) {
      const check = await verifyImageAgainstBrief({
        buffer: fetched.buffer,
        contentType: fetched.contentType,
        brief,
        query: opts.subject || query,
        platformMeta: item,
      });
      if (!check.match) return null;
    }
    return {
      ...fetched,
      title: item.title || q,
      sourceUrl: item.pageUrl || item.url,
      verified: Boolean(verify && brief),
      _key: item.url.split("?")[0],
    };
  } catch {
    return null;
  }
}

async function fetchCandidatesInParallel(entries, maxImages, opts, verify, brief, query) {
  const results = [];
  const seen = new Set();
  for (let i = 0; i < entries.length && results.length < maxImages; i += BATCH_FETCH_CONCURRENCY) {
    const chunk = entries.slice(i, i + BATCH_FETCH_CONCURRENCY);
    const settled = await Promise.all(
      chunk.map(({ item, q }) => tryFetchOneCandidate(item, q, opts, verify, brief, query)),
    );
    for (const row of settled) {
      if (!row || seen.has(row._key)) continue;
      seen.add(row._key);
      const { _key, ...rest } = row;
      results.push(rest);
      if (results.length >= maxImages) break;
    }
  }
  return results;
}

function variantLimitForIntent(intentType) {
  return intentType === "general" ? 3 : 8;
}

async function gatherCandidateEntries(uniqueVariants, opts, maxImages, intentType) {
  const seen = new Set();
  const entries = [];
  const limit = variantLimitForIntent(intentType);
  const targetCount = maxImages * 2;
  for (const q of uniqueVariants.slice(0, limit)) {
    if (entries.length >= targetCount) break;
    const candidates = await collectImageCandidates(q, {
      ...opts,
      maxCandidates: Math.max(maxImages * 2, 8),
    });
    const ordered = orderCandidatesForVerify(candidates, true);
    const strong = ordered.filter((item) => (item.score || 0) >= 6).length;
    for (const item of ordered) {
      const key = item.url.split("?")[0];
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({ item, q });
      if (entries.length >= maxImages * 3) return entries;
    }
    // 首个 variant 已有足够高分候选时提前结束，减少串行 API 调用
    if (entries.length >= targetCount && strong >= maxImages) break;
  }
  return entries;
}

/**
 * 批量检索并校验图片（用于素材包）
 */
export async function findVerifiedImageBatch(query, opts = {}) {
  const maxImages = resolveMaxImages(opts);
  const intentType = opts.intentType || "materials";
  const variants = expandImageSearchVariants(query, opts);
  const uniqueVariants = [...new Set(variants.map((q) => String(q).trim()).filter(Boolean))];

  let verify = opts.verify !== false && mediaVerifyEnabled() && intentType !== "general";
  let brief = null;
  if (verify) {
    try {
      brief = await buildMediaVerifyBrief(query, "image", { intentType });
    } catch {
      verify = false;
    }
  }

  let results = await fetchCandidatesInParallel(
    await gatherCandidateEntries(uniqueVariants, opts, maxImages, intentType),
    maxImages,
    opts,
    verify,
    brief,
    query,
  );

  if (!results.length) {
    const relaxedEntries = await gatherCandidateEntries(
      uniqueVariants,
      { ...opts, intentType: "general", rejectHints: [] },
      maxImages,
      "general",
    );
    results = await fetchCandidatesInParallel(
      relaxedEntries,
      maxImages,
      { ...opts, intentType: "general", rejectHints: [] },
      false,
      null,
      query,
    );
  }

  if (!results.length) {
    try {
      const one = await findAndFetchImage(query, {
        ...opts,
        verify: false,
        intentType: "general",
      });
      results = [one];
    } catch {
      // fall through
    }
  }

  if (!results.length) {
    throw new HttpError(404, "NO_IMAGE_CANDIDATES");
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
  const res = await fetchWithProxyFallback(safe, {
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

  let verify = opts.verify !== false && mediaVerifyEnabled();
  let brief = null;
  if (verify) {
    try {
      brief = await buildMediaVerifyBrief(query, "image", { intentType: opts.intentType });
    } catch {
      verify = false;
    }
  }
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
  }

  const relaxed = await fetchBestUnverifiedImage(ordered, {
    ...opts,
    query,
    intentType: "general",
    rejectHints: [],
  });
  if (relaxed) return relaxed;

  if (verify && brief) {
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

  const core = stripImageSearchNoise(opts.subject || cleaned || query);
  if (core && core !== cleaned) {
    try {
      return await findAndFetchImageOnce(core, {
        ...opts,
        subject: core,
        verify: false,
        queryVariants: buildHotelEnglishVariants(core),
      });
    } catch {
      /* fall through */
    }
  }

  if (lastError instanceof HttpError) throw lastError;
  throw new HttpError(404, "NO_IMAGE_CANDIDATES");
}
