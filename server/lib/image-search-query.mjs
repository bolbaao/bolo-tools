/** 从搜索词中去掉「图片/高清」等噪音，图搜引擎不需要这些词 */
export function stripImageSearchNoise(raw) {
  return String(raw || "")
    .replace(/(?:的)?(?:相关)?(?:高清)?(?:宣传)?(?:配图|图片|照片|图像|素材|图集|图包)/gi, " ")
    .replace(/(?:^|\s)(?:门店照片|门店环境|门店|环境|宣传|官方|品牌)(?:\s|$)/gi, " ")
    .replace(/(?:^|\s)(?:高清|hd|4k|8k)(?:\s|$)/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^的+|的+$/g, "")
    .trim();
}

/** 平台检索用的核心主体（去掉「门店/宣传」等泛化后缀） */
export function platformSearchKeyword(query, subject = "") {
  const fromSubject = stripImageSearchNoise(subject);
  if (fromSubject && fromSubject.length >= 2) return fromSubject;
  return stripImageSearchNoise(query);
}

/** 根据主体与意图生成多组备选搜索词 */
export function buildGeneralSearchVariants(subject, intentType = "general") {
  const core = stripImageSearchNoise(subject);
  if (!core || core.length < 2) return [];

  const variants = [];
  if (intentType === "logo") {
    variants.push(`${core} logo`, `${core} 标志`, `${core} 官方 logo`);
  } else if (intentType === "poster") {
    variants.push(`${core} 产品海报`, `${core} 官方宣传图`, `${core} 宣传主视觉`);
  } else {
    variants.push(
      core,
      `${core} 宣传`,
      `${core} 门店`,
      `${core} logo`,
      `${core} 官方`,
      `${core} 品牌`,
    );
    if (/ktv|KTV|酒吧|餐厅|咖啡|奶茶|酒店|门店|店/i.test(core)) {
      variants.push(`${core} 门店照片`, `${core} 环境`);
    }
  }
  return [...new Set(variants.filter((v) => v && v !== core))];
}

export function expandImageSearchVariants(query, opts = {}) {
  const primary = stripImageSearchNoise(query);
  if (!primary) return [];
  const intentType = opts.intentType || "general";
  const extras = buildGeneralSearchVariants(primary, intentType);
  const fromOpts = Array.isArray(opts.queryVariants) ? opts.queryVariants : [];
  return [...new Set([primary, ...fromOpts.map(stripImageSearchNoise), ...extras].filter(Boolean))];
}

/** 从主体名提取用于相关性匹配的核心词 */
export function coreSubjectTokens(subject) {
  const core = stripImageSearchNoise(subject).toLowerCase();
  if (!core) return { primary: "", tokens: [] };
  const zhPhrases = (core.match(/[\u4e00-\u9fff]{2,}/g) || []).sort((a, b) => b.length - a.length);
  const tokens = [...new Set([...zhPhrases, ...( /ktv/i.test(core) ? ["ktv"] : [])])];
  const primary = zhPhrases[0] || core;
  return { primary, tokens };
}

/** 标题是否与检索主体相关（过滤「娱乐无界」「KTV七店通用」等误命中） */
export function titleMatchesSubject(title, subject) {
  const { primary, tokens } = coreSubjectTokens(subject);
  if (!primary || primary.length < 2) return true;
  const hay = String(title || "").toLowerCase();
  if (hay.includes(primary.toLowerCase())) return true;
  const zhTokens = tokens.filter((t) => /[\u4e00-\u9fff]/.test(t) && t.length >= 2);
  return zhTokens.some((t) => t.length >= 3 && hay.includes(t.toLowerCase()));
}
