/** @typedef {'quick'|'deep'|'academic'|'news'|'multilingual'|'media'} AiSearchMode */

export const AI_SEARCH_MODES = {
  quick: {
    id: "quick",
    label: "快速搜索",
    depth: "basic",
    topic: "general",
    maxResults: 5,
    maxVariants: 1,
    synthesize: true,
  },
  deep: {
    id: "deep",
    label: "深度搜索",
    depth: "advanced",
    topic: "general",
    maxResults: 10,
    maxVariants: 4,
    synthesize: true,
  },
  academic: {
    id: "academic",
    label: "学术搜索",
    depth: "advanced",
    topic: "general",
    maxResults: 10,
    maxVariants: 4,
    synthesize: true,
  },
  news: {
    id: "news",
    label: "新闻搜索",
    depth: "advanced",
    topic: "news",
    maxResults: 10,
    maxVariants: 3,
    days: 7,
    synthesize: true,
  },
  multilingual: {
    id: "multilingual",
    label: "多语言搜索",
    depth: "advanced",
    topic: "general",
    maxResults: 10,
    maxVariants: 3,
    synthesize: true,
  },
  media: {
    id: "media",
    label: "媒体搜索",
    depth: "basic",
    topic: "general",
    maxResults: 12,
    maxVariants: 0,
    synthesize: true,
  },
};

const ACADEMIC_SOURCE_RE =
  /scholar\.google|arxiv\.org|doi\.org|ieee\.org|acm\.org|pubmed|ncbi\.nlm|researchgate|semanticscholar|wanfangdata|cnki|xueshu\.baidu|springer|sciencedirect|nature\.com|wiley\.com|jstor\.org/i;

function countScript(text, re) {
  const m = String(text || "").match(re);
  return m ? m.length : 0;
}

/** 根据问题文本推断多语言检索区域 */
export function detectMultilingualRegion(text) {
  const msg = String(text || "").trim();
  const latin = countScript(msg, /[A-Za-z]/g);
  const cjk = countScript(msg, /[\u4e00-\u9fff]/g);
  const kana = countScript(msg, /[\u3040-\u30ff]/g);
  const hangul = countScript(msg, /[\uac00-\ud7af]/g);

  if (kana >= 2 && kana >= latin) {
    return { id: "jp", label: "日本", gl: "jp", hl: "ja", tavilyCountry: "japan", userSpecified: true };
  }
  if (hangul >= 2) {
    return { id: "kr", label: "韩国", gl: "kr", hl: "ko", tavilyCountry: "south korea", userSpecified: true };
  }
  if (latin >= 4 && latin > cjk * 1.2) {
    return { id: "en", label: "国际", gl: "us", hl: "en", tavilyCountry: "united states", userSpecified: true };
  }
  return null;
}

/**
 * @param {string} modeRaw
 * @param {string} query
 */
export function resolveSearchModeConfig(modeRaw, query = "") {
  const mode = AI_SEARCH_MODES[modeRaw] ? modeRaw : "deep";
  const base = AI_SEARCH_MODES[mode];
  const multilingualRegion = mode === "multilingual" ? detectMultilingualRegion(query) : null;

  return {
    mode,
    label: base.label,
    depth: base.depth,
    topic: base.topic,
    maxResults: base.maxResults,
    maxVariants: base.maxVariants,
    days: base.days,
    synthesize: base.synthesize !== false,
    skipChinaAugment: mode === "multilingual" || Boolean(multilingualRegion),
    regionOverride: multilingualRegion,
    academic: mode === "academic",
    multilingual: mode === "multilingual",
    media: mode === "media",
    forceChinese: mode === "news" || mode === "media",
  };
}

/** @param {AiSearchMode} mode */
export function getModePlanHint(mode) {
  switch (mode) {
    case "quick":
      return "用户选择快速搜索：主检索词要精准简洁，扩散词最多 1 条，优先直接命中答案。";
    case "deep":
      return "用户选择深度搜索：全面扩散检索，searchVariants 给 3-5 条不同角度。";
    case "academic":
      return "用户选择学术搜索：优先论文、期刊、研究报告、学位论文、学术机构来源。检索词应含「论文」「研究」「综述」「journal」「paper」等学术语境，扩散词覆盖中英文数据库与 scholar/arxiv 等。";
    case "news":
      return "用户选择新闻搜索：topic 填 news，检索词突出最新进展、事件主体、时间。";
    case "multilingual":
      return "用户选择多语言搜索：保留用户原语言关键词，必要时补充英文/目标语言检索词，不要强行翻译成中文。";
    case "media":
      return "用户选择媒体搜索：检索词保持中文，面向抖音、小红书、微信公众号等平台内容，不要翻译成英文。";
    default:
      return "";
  }
}

/** @param {AiSearchMode} mode */
export function getModeSynthesisHint(mode) {
  switch (mode) {
    case "quick":
      return "9. 快速模式：回答控制在 3-6 句或短列表，直奔结论。";
    case "academic":
      return "9. 学术模式：优先引用论文/研究机构/期刊信息，标注作者、年份、期刊名（若来源有），区分综述与原始研究。";
    case "news":
      return "9. 新闻模式：按时间线组织，突出最新进展与事件主体。";
    case "multilingual":
      return "9. 多语言模式：可保留关键英文/外文专名，并给出中文解释。";
    case "media":
      return "9. 媒体模式：优先引用抖音、小红书、微信公众号来源，标注平台名称，链接必须是中文媒体页面。";
    default:
      return "";
  }
}

export function augmentAcademicPlan(plan) {
  const core = String(plan.searchQuery || plan.originalQuery || "").trim();
  if (!core) return plan;

  const variants = new Set(plan.searchVariants || []);
  variants.add(`${core} 论文`);
  variants.add(`${core} research paper`);
  variants.add(`${core} 学术综述`);
  if (/[\u4e00-\u9fff]/.test(core)) {
    variants.add(`${core} site:scholar.google.com`);
  }

  return {
    ...plan,
    searchQuery: /论文|研究|paper|journal|学术/.test(core) ? core : `${core} 学术论文`,
    searchVariants: [...variants].filter((v) => v && v !== plan.searchQuery).slice(0, 5),
  };
}

export function scoreAcademicResult(item) {
  const url = String(item?.url || "");
  const text = `${item.title || ""} ${item.snippet || ""}`;
  let score = 0;
  if (ACADEMIC_SOURCE_RE.test(url)) score += 8;
  if (/论文|期刊|研究|综述|paper|journal|doi|arxiv|scholar/i.test(text)) score += 3;
  if (/\.pdf(\?|$)/i.test(url)) score += 2;
  return score;
}
