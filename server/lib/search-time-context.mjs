/** 供搜索理解/摘要使用的当前时间上下文 */
export function getSearchTimeContext(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  return {
    year,
    month,
    day,
    dateLabel: `${year}年${month}月${day}日`,
    isoDate: now.toISOString().slice(0, 10),
  };
}

const RECENCY_RE =
  /(?:最近|近期|近来|当下|目前|现在|今年|很火|火爆|热播|热门|最新|时下|当前|这几天|正在火|火的那|啥剧|什么剧)/;

const HISTORICAL_RE = /(?:往年|去年|前年|20\d{2}年(?!\s*(?:春节|元旦))|历史上|当年|那时候)/;

/** 用户是否在问「当下/近期」类时效信息 */
export function detectRecencyIntent(text) {
  const msg = String(text || "").trim();
  if (!msg) return false;
  if (HISTORICAL_RE.test(msg)) return false;
  return RECENCY_RE.test(msg);
}

/**
 * 为时效类检索词补上当前年份，避免搜到往年结果。
 * @param {{ searchQuery: string, searchVariants?: string[], topic?: string }} plan
 */
export function applyRecencyToSearchPlan(plan, timeContext = getSearchTimeContext()) {
  const year = String(timeContext.year);
  const withYear = (q) => {
    const text = String(q || "").trim();
    if (!text || new RegExp(year).test(text)) return text;
    return `${year} ${text}`;
  };

  const recencyIntent = detectRecencyIntent(plan.originalQuery);
  const searchQuery = withYear(plan.searchQuery);
  const variantSet = new Set(
    (plan.searchVariants || []).map(withYear).filter((v) => v && v !== searchQuery),
  );

  if (recencyIntent) {
    const core = searchQuery.replace(/^\d{4}\s+/, "").replace(/^中国\s+/, "").trim();
    if (core) {
      const month = timeContext.month;
      const extras = [
        `${year}年${month}月 ${core}`,
        `${year} 近期 ${core}`,
        `${year} 最新 ${core}`,
      ];
      if (!/(?:热播|热门|最新|近期)/.test(core)) {
        extras.unshift(`${year} ${core} 热播`);
      }
      if (/(?:剧|仙侠|修仙)/.test(plan.originalQuery)) {
        extras.push(`${year} 国产仙侠剧 热播`, `${year} 中国古装剧 热播榜`);
      }
      for (const item of extras) variantSet.add(item);
    }
  }

  return {
    ...plan,
    searchQuery,
    searchVariants: [...variantSet],
    topic: plan.topic === "news" || recencyIntent ? "news" : plan.topic,
    recencyIntent,
    timeContext,
  };
}
