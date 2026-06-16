import { env } from "./env.mjs";
import { fetchWithProxyFallback } from "./fetch-helper.mjs";
import { HttpError } from "./http-error.mjs";
import { searchWeb, getWebSearchCapabilities } from "./web-search.mjs";
import { fetchRemoteImage } from "./image-search.mjs";
import {
  extractSearchKeywords,
  stripImageSearchNoise,
  textMatchesSearchKeywords,
} from "./image-search-query.mjs";
import { verifyVideoCandidateForWebSearch } from "./media-verify.mjs";
import { photoVisionConfigured } from "./photo-vision.mjs";
import { formatSearchNotFound } from "../../shared/public-error.mjs";

const CN_REGION = { id: "cn", label: "中国", gl: "cn", hl: "zh-cn", tavilyCountry: "china" };
const VERIFY_CONCURRENCY = 3;
const MAX_VERIFY_ATTEMPTS = 20;

const VIDEO_SITE_HINTS = [
  { id: "bilibili", label: "哔哩哔哩", site: "bilibili.com", re: /bilibili\.com/i },
  { id: "douyin", label: "抖音", site: "douyin.com", re: /douyin\.com|iesdouyin\.com/i },
  { id: "youtube", label: "YouTube", site: "youtube.com", re: /youtube\.com|youtu\.be/i },
  { id: "weixin", label: "微信视频号", site: "channels.weixin.qq.com", re: /channels\.weixin\.qq\.com/i },
];

export function webVideoSearchReady() {
  return Boolean(env("SERPER_API_KEY")) || getWebSearchCapabilities().available;
}

function dedupeResults(results = []) {
  const seen = new Set();
  const out = [];
  for (const item of results) {
    const url = String(item?.url || "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(item);
  }
  return out;
}

function detectVideoPlatform(url) {
  for (const hint of VIDEO_SITE_HINTS) {
    if (hint.re.test(url)) return hint;
  }
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return { id: host, label: host };
  } catch {
    return { id: "web", label: "网页" };
  }
}

function toVideoResult(item, verifyMeta = {}) {
  const url = String(item.url || item.link || "").trim();
  if (!url) return null;
  const platform = detectVideoPlatform(url);
  const title = String(item.title || "").trim() || "视频";
  const snippet = String(item.snippet || item.description || "").trim().slice(0, 600);
  const channel = String(item.channel || item.source || "").trim();
  const duration = String(item.duration || "").trim();
  const thumbnailUrl = String(item.thumbnailUrl || item.imageUrl || "").trim() || undefined;
  const detected = Array.isArray(verifyMeta.detectedKeywords)
    ? verifyMeta.detectedKeywords.filter(Boolean)
    : [];

  const meta = [platform.label, channel, duration].filter(Boolean);
  if (detected.length) meta.push(`识别：${detected.slice(0, 3).join("、")}`);
  if (verifyMeta.verified) meta.push("已校验");

  return {
    title,
    url,
    snippet: snippet || meta.join(" · ") || "视频",
    thumbnailUrl,
    duration: duration || undefined,
    channel: channel || undefined,
    platform: platform.id,
    platformLabel: platform.label,
    score: item.score,
    verified: Boolean(verifyMeta.verified),
    detectedKeywords: detected.length ? detected : undefined,
  };
}

/**
 * @param {string} query
 * @param {{ maxResults?: number, region?: object }} opts
 */
async function searchSerperVideos(query, opts = {}) {
  const apiKey = env("SERPER_API_KEY");
  if (!apiKey) return [];

  const maxResults = Math.min(16, Math.max(4, Number(opts.maxResults) || 12));
  const region = opts.region || CN_REGION;
  try {
    const res = await fetchWithProxyFallback("https://google.serper.dev/videos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        q: query,
        num: maxResults,
        gl: region.gl || "cn",
        hl: region.hl || "zh-cn",
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn("[video-search] Serper HTTP", res.status, data?.message || "");
      return [];
    }
    return (data.videos || [])
      .map((item) =>
        toVideoResult({
          title: item.title,
          url: item.link,
          snippet: item.snippet,
          thumbnailUrl: item.imageUrl,
          duration: item.duration,
          channel: item.channel,
        }),
      )
      .filter(Boolean);
  } catch (e) {
    console.warn("[video-search] Serper failed:", e?.message || e);
    return [];
  }
}

async function searchWebVideoPages(query, maxResults = 8) {
  if (!getWebSearchCapabilities().available) return [];

  const perSite = Math.max(2, Math.ceil(maxResults / VIDEO_SITE_HINTS.length));
  const chunks = await Promise.all(
    VIDEO_SITE_HINTS.map(async (hint) => {
      try {
        const payload = await searchWeb(`${query} site:${hint.site}`, {
          depth: "basic",
          maxResults: perSite,
          region: CN_REGION,
        });
        return (payload.results || [])
          .filter((r) => hint.re.test(r.url || ""))
          .map((r) =>
            toVideoResult({
              title: r.title,
              url: r.url,
              snippet: r.snippet,
              channel: hint.label,
              score: 2,
            }),
          )
          .filter(Boolean);
      } catch {
        return [];
      }
    }),
  );

  return dedupeResults(chunks.flat());
}

async function tryVerifyVideo(item, core) {
  const title = item.title || "";
  const snippet = item.snippet || "";
  if (!textMatchesSearchKeywords(`${title} ${snippet}`, core)) return null;

  let thumbnailBuffer;
  let thumbnailContentType;
  if (item.thumbnailUrl && photoVisionConfigured()) {
    try {
      const fetched = await fetchRemoteImage(item.thumbnailUrl);
      thumbnailBuffer = fetched.buffer;
      thumbnailContentType = fetched.contentType;
    } catch {
      /* verify by title only */
    }
  }

  const check = await verifyVideoCandidateForWebSearch({
    query: core,
    title,
    snippet,
    thumbnailBuffer,
    thumbnailContentType,
  });
  if (!check.match) return null;

  return toVideoResult(item, {
    verified: Boolean(thumbnailBuffer) || !photoVisionConfigured(),
    detectedKeywords: check.detectedKeywords,
  });
}

async function verifyVideoResults(candidates, core, maxResults) {
  const pool = candidates.slice(0, MAX_VERIFY_ATTEMPTS);
  const results = [];
  const seen = new Set();

  for (let i = 0; i < pool.length && results.length < maxResults; i += VERIFY_CONCURRENCY) {
    const chunk = pool.slice(i, i + VERIFY_CONCURRENCY);
    const settled = await Promise.all(chunk.map((item) => tryVerifyVideo(item, core)));
    for (const row of settled) {
      if (!row) continue;
      const key = row.url;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(row);
      if (results.length >= maxResults) break;
    }
  }

  return results;
}

/**
 * 全网视频检索：提取关键词 → 候选检索 → 标题/封面校验，仅返回与关键词一致的视频
 * @param {string} query
 * @param {{ maxResults?: number }} opts
 */
export async function searchWebVideos(query, opts = {}) {
  const keyword = String(query || "").trim();
  if (!keyword) {
    return { query: "", searchQuery: "", results: [], provider: "video", mode: "videos" };
  }
  if (!webVideoSearchReady()) {
    throw new HttpError(503, "视频搜索暂不可用，请稍后再试。如需开通请联系客服。");
  }

  const core = stripImageSearchNoise(keyword) || keyword;
  const { keywords } = extractSearchKeywords(core);
  const maxResults = Math.min(20, Math.max(4, Number(opts.maxResults) || 12));
  const poolSize = Math.min(MAX_VERIFY_ATTEMPTS, maxResults * 3);

  const serper = await searchSerperVideos(core, { maxResults: poolSize, region: CN_REGION });
  let candidates = serper;

  if (candidates.length < poolSize) {
    const web = await searchWebVideoPages(core, poolSize);
    candidates = dedupeResults([...candidates, ...web]);
  }

  const results = await verifyVideoResults(candidates, core, maxResults);
  if (!results.length) {
    throw new HttpError(422, formatSearchNotFound(keyword));
  }

  const visionNote = photoVisionConfigured() ? "封面识图 + 标题" : "标题关键词";
  return {
    query: keyword,
    searchQuery: core,
    searchVariants: keywords.length ? keywords : [core],
    understanding: `在全网检索「${core}」，并通过${visionNote}校验仅保留与关键词一致的视频`,
    results,
    provider: serper.length ? "serper" : "web",
    topic: "general",
    planned: false,
    mode: "videos",
    modeLabel: "视频搜索",
    region: CN_REGION,
    recencyIntent: false,
    queriesUsed: [core],
    verified: photoVisionConfigured(),
  };
}
