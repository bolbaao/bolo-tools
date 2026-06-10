import { scoreAcademicResult } from "./ai-search-modes.mjs";
const DEFAULT_REGION = {
  id: "cn",
  label: "中国",
  gl: "cn",
  hl: "zh-cn",
  tavilyCountry: "cn",
};

const REGION_RULES = [
  { id: "us", label: "美国", gl: "us", hl: "en", tavilyCountry: "us", re: /美国|美区|USA\b|U\.S\.|美式/ },
  { id: "jp", label: "日本", gl: "jp", hl: "ja", tavilyCountry: "jp", re: /日本|日区|日式|Japan/ },
  { id: "kr", label: "韩国", gl: "kr", hl: "ko", tavilyCountry: "kr", re: /韩国|韩区|韩式|Korea/ },
  { id: "uk", label: "英国", gl: "uk", hl: "en", tavilyCountry: "gb", re: /英国|英伦|UK\b|Britain/ },
  { id: "tw", label: "台湾", gl: "tw", hl: "zh-tw", tavilyCountry: "tw", re: /台湾|台剧|台版/ },
  { id: "hk", label: "香港", gl: "hk", hl: "zh-hk", tavilyCountry: "hk", re: /香港|港剧|港版/ },
  { id: "cn", label: "中国", gl: "cn", hl: "zh-cn", tavilyCountry: "cn", re: /中国|国内|内地|大陆|国服|国产/ },
];

const ENTERTAINMENT_RE = /(?:剧|电影|影片|综艺|动漫|仙侠|修仙|热播|电视剧|院线)/;

const CN_SOURCE_RE =
  /\.cn\b|douban|weibo|zhihu|bilibili|iqiyi|youku|tencent|163\.com|sina|sohu|baidu|douyin|xiaohongshu|xhslink|mtime|maoyan|1905|cctv|people\.com|xinhuanet|thepaper|jiemian|huxiu|36kr|mp\.weixin|weixin\.qq/i;

const EN_FOREIGN_NEWS_RE =
  /bbc\.(com|co)|cnn\.com|nytimes|reuters\.com|theguardian|wsj\.com|forbes\.com|bloomberg|apnews|npr\.org|foxnews|washingtonpost/i;

/**
 * 过滤非中文网页，优先保留国内来源与含中文标题/摘要的结果。
 * @param {Array<{ title?: string, url?: string, snippet?: string }>} results
 */
export function filterChineseResults(results = []) {
  const list = Array.isArray(results) ? results : [];
  const filtered = list.filter((item) => {
    const url = String(item?.url || "");
    const text = `${item?.title || ""} ${item?.snippet || ""}`;
    if (EN_FOREIGN_NEWS_RE.test(url)) return false;
    if (CN_SOURCE_RE.test(url)) return true;
    const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    if (cjk >= 4) return true;
    return cjk >= 2 && !/^[A-Za-z0-9\s.,!?'"()-]+$/.test(text.trim());
  });
  return filtered.length ? filtered : list.filter((item) => CN_SOURCE_RE.test(String(item?.url || "")));
}

/**
 * 从用户问题识别检索区域；未指定则默认中国。
 * @param {string} text
 */
export function detectSearchRegion(text) {
  const msg = String(text || "").trim();
  for (const rule of REGION_RULES) {
    if (rule.id !== "cn" && rule.re.test(msg)) {
      return {
        id: rule.id,
        label: rule.label,
        gl: rule.gl,
        hl: rule.hl,
        tavilyCountry: rule.tavilyCountry,
        userSpecified: true,
      };
    }
  }
  if (REGION_RULES.find((r) => r.id === "cn")?.re.test(msg)) {
    return { ...DEFAULT_REGION, userSpecified: true };
  }
  return { ...DEFAULT_REGION, userSpecified: false };
}

export function isEntertainmentQuery(text) {
  return ENTERTAINMENT_RE.test(String(text || ""));
}

/** 娱乐类时效问题用 general+country，比 news 更易命中中文榜单且可设中国区 */
export function resolveSearchTopic(plan) {
  if (!plan?.recencyIntent) return plan?.topic || "general";
  if (isEntertainmentQuery(plan.originalQuery) || isEntertainmentQuery(plan.searchQuery)) {
    return "general";
  }
  return plan.topic === "news" ? "news" : "general";
}

function hasRegionMarker(text, region) {
  const q = String(text || "");
  if (region.id === "cn") return /中国|国内|内地|大陆|国产/.test(q);
  return q.includes(region.label);
}

/**
 * 默认中国区时，为检索词补上地域词（用户已指定区域则不重复补）。
 */
export function applyRegionToSearchPlan(plan, region = detectSearchRegion(plan.originalQuery), opts = {}) {
  if (opts.skipAugment) {
    return {
      ...plan,
      region,
      topic: resolveSearchTopic({ ...plan, region }),
    };
  }

  const augment = (q) => {
    const text = String(q || "").trim();
    if (!text || hasRegionMarker(text, region)) return text;
    if (region.id === "cn") {
      if (isEntertainmentQuery(plan.originalQuery) || isEntertainmentQuery(text)) {
        return `中国 ${text}`;
      }
      return `中国 ${text}`;
    }
    return `${region.label} ${text}`;
  };

  const searchQuery = augment(plan.searchQuery);
  const variantSet = new Set(
    (plan.searchVariants || []).map(augment).filter((v) => v && v !== searchQuery),
  );

  if (region.id === "cn" && !plan.userSpecifiedRegion) {
    const core = searchQuery.replace(/^中国\s+/, "").trim();
    if (core && isEntertainmentQuery(plan.originalQuery)) {
      variantSet.add(augment(`国产 ${core}`));
      variantSet.add(augment(`${core} 豆瓣`));
    }
  }

  return {
    ...plan,
    searchQuery,
    searchVariants: [...variantSet],
    region,
    topic: resolveSearchTopic({ ...plan, searchQuery }),
  };
}

function mentionsOnlyStaleYear(text, currentYear) {
  const stale = currentYear - 1;
  const hay = String(text || "");
  const hasStale = new RegExp(`\\b${stale}\\b|${stale}年`).test(hay);
  const hasCurrent = new RegExp(`\\b${currentYear}\\b|${currentYear}年`).test(hay);
  return hasStale && !hasCurrent;
}

function scoreSearchResult(item, opts) {
  const text = `${item.title || ""} ${item.snippet || ""}`;
  const url = String(item.url || "");
  let score = typeof item.score === "number" ? item.score : 0;

  if (opts.region?.id === "cn") {
    if (CN_SOURCE_RE.test(url)) score += 4;
    if (/[\u4e00-\u9fff]/.test(text)) score += 1;
  }

  if (opts.recencyIntent && opts.timeContext?.year) {
    const year = opts.timeContext.year;
    if (new RegExp(`${year}年?`).test(text)) score += 6;
    if (mentionsOnlyStaleYear(text, year)) score -= 12;
  }

  if (opts.academic) {
    score += scoreAcademicResult(item);
  }

  return score;
}

/**
 * 时效类问题：优先当前年与中国区来源，压低往年榜单类结果。
 */
export function rankAndFilterSearchResults(results = [], opts = {}) {
  const list = (Array.isArray(results) ? results : []).map((item) => ({
    ...item,
    _rankScore: scoreSearchResult(item, opts),
  }));

  list.sort((a, b) => b._rankScore - a._rankScore);

  if (!opts.recencyIntent || !opts.timeContext?.year) {
    return list.map(({ _rankScore, ...item }) => item);
  }

  const year = opts.timeContext.year;
  const fresh = list.filter((item) => !mentionsOnlyStaleYear(`${item.title} ${item.snippet}`, year));
  const picked = (fresh.length >= 1 ? fresh : list)
    .slice(0, opts.maxResults || 12)
    .map(({ _rankScore, ...item }) => item);

  return picked;
}
