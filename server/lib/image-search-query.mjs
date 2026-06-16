/** 用户消息中的直链图片 URL */
export const DIRECT_IMAGE_URL_RE =
  /https?:\/\/\S+\.(?:png|jpe?g|webp|gif)(?:\?\S*)?/i;

/** 海报/素材检索时应排除的截图类干扰项 */
export const DEFAULT_IMAGE_REJECT_HINTS = [
  "排行榜截图",
  "榜单截图",
  "商品列表",
  "商品列表页",
  "商城界面",
  "商城界面截图",
  "APP截图",
  "APP界面截图",
  "多商品拼接",
  "多商品合集拼图",
  "无关竞品合集",
];

const HOTEL_BRAND_EN = [
  [/希尔顿/g, "Hilton"],
  [/万豪|marriott/gi, "Marriott"],
  [/洲际/g, "InterContinental"],
  [/凯悦/g, "Hyatt"],
  [/喜来登/g, "Sheraton"],
  [/香格里拉/g, "Shangri-La"],
  [/丽思卡尔顿/g, "Ritz-Carlton"],
  [/皇冠假日/g, "Crowne Plaza"],
  [/全季/g, "Ji Hotel"],
  [/亚朵/g, "Atour"],
];

const CN_CITIES =
  /北京|上海|广州|深圳|南京|杭州|成都|武汉|西安|重庆|苏州|天津|厦门|青岛|大连|长沙|郑州|沈阳|合肥|福州|昆明|宁波|东莞|佛山|无锡|滨江/;

const STORE_SUFFIXES = ["咖啡店", "咖啡厅", "咖啡", "奶茶店", "奶茶", "门店", "实体店", "餐厅", "酒吧", "品牌", "店"];

const STORE_BRAND_EN = [
  [/星巴克/g, "Starbucks"],
  [/瑞幸/g, "Luckin"],
  [/喜茶/g, "HEYTEA"],
  [/奈雪/g, "Nayuki"],
  [/肯德基/g, "KFC"],
  [/麦当劳/g, "McDonald's"],
  [/必胜客/g, "Pizza Hut"],
  [/海底捞/g, "Haidilao"],
];

/** 拆分「品牌+门店/咖啡」类检索词 */
export function splitStoreBrand(core) {
  const text = String(core || "").trim();
  if (!text) return { brand: "", suffix: "" };
  for (const suf of STORE_SUFFIXES) {
    if (text.endsWith(suf) && text.length > suf.length + 1) {
      return { brand: text.slice(0, -suf.length), suffix: suf };
    }
  }
  return { brand: "", suffix: "" };
}

function appendStoreEnglishAliases(tokens, core) {
  for (const [re, alias] of STORE_BRAND_EN) {
    if (re.test(core)) tokens.add(alias.toLowerCase());
  }
}

/** 展开主体词为品牌、后缀、英文别名等多粒度 token */
export function expandSubjectTokens(core) {
  const text = String(core || "").trim();
  const tokens = new Set();
  for (const phrase of text.match(/[\u4e00-\u9fff]{2,}/g) || []) tokens.add(phrase);
  for (const word of text.match(/[a-zA-Z][a-zA-Z0-9'-]{1,}/g) || []) tokens.add(word.toLowerCase());

  const { brand, suffix } = splitStoreBrand(text);
  if (brand) {
    tokens.add(brand);
    if (suffix) tokens.add(suffix);
  }
  for (const suf of STORE_SUFFIXES) {
    if (text.endsWith(suf) && text.length > suf.length + 1) {
      tokens.add(text.slice(0, -suf.length));
      tokens.add(suf);
    }
  }
  appendStoreEnglishAliases(tokens, text);
  return [...tokens].filter((t) => t.length >= 2);
}

/** 门店/品牌类检索用的多组搜索词 */
export function buildStoreSearchQueries(query) {
  const core = stripImageSearchNoise(query);
  if (!core) return [];
  const queries = new Set([core]);
  const { brand } = splitStoreBrand(core);
  if (brand) {
    queries.add(brand);
    queries.add(`${brand} 门店`);
    queries.add(`${brand} 门店实拍`);
    queries.add(`${brand} 咖啡店`);
    queries.add(`${brand} 店内`);
  }
  if (isStoreLikeSubject(core)) {
    const platformKw = platformSearchKeyword(query, core);
    if (platformKw) queries.add(platformKw);
  }
  return [...queries].filter(Boolean);
}

/** 门店 / KTV / 餐饮等品牌类检索主体 */
export function isStoreLikeSubject(subject) {
  const s = String(subject || "");
  return /ktv|KTV|酒吧|餐厅|咖啡|奶茶|门店|店|品牌/i.test(s) && !isScenicLikeSubject(s);
}

/** 酒店 / 门店类检索主体 */
export function isHotelLikeSubject(subject) {
  const s = String(subject || "");
  return /酒店|宾馆|客栈|民宿|度假村|希尔顿|万豪|洲际|凯悦|喜来登|香格里拉|全季|亚朵|如家|汉庭|7天|锦江|民宿/i.test(s);
}

/** 地标 / 风景 / 城市等通用找图主体（非品牌门店） */
export function isScenicLikeSubject(subject) {
  const s = String(subject || "");
  if (isHotelLikeSubject(s)) return false;
  if (/ktv|KTV|酒吧|餐厅|咖啡|奶茶|门店|品牌|logo|海报|产品/i.test(s)) return false;
  return (
    /门|楼|塔|寺|宫|园|山|湖|海|江|河|滩|瀑布|岛|广场|风景|景区|公园|博物|纪念|大桥|古城|古镇|动物|猫|狗|花|树|樱花|雪/.test(s) ||
    CN_CITIES.test(s)
  );
}

/** 去掉「找几张…」等请求噪音，保留核心主体 */
export function stripImageRequestFluff(raw) {
  return String(raw || "")
    .replace(/^[「『""]?|[」』""]$/g, "")
    .replace(/^(?:请|帮我?|给我|麻烦|能否|可以|想要?)+/, "")
    .replace(/^(?:找|搜|查|发|要|下载|看看|提供|展示|显示|来|出)+/, "")
    .replace(/^(?:几(?:张|个)?|一些|多张|若干|多个|一点)+/, "")
    .replace(/^(?:张|个|下|一下)+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 从用户原话解析期望张数：几张→4，多张→6，3张→3；未说明时返回 0 */
export function parseRequestedImageCount(text) {
  const msg = String(text || "");
  const exact = msg.match(/(\d+)\s*张/);
  if (exact) return Math.min(20, Math.max(2, Number(exact[1]) || 2));
  if (/几张|一些|若干/.test(msg)) return 4;
  if (/多张|一批/.test(msg)) return 6;
  return 0;
}

/** 未说明张数时的默认返回数量 */
export const DEFAULT_IMAGE_FETCH_COUNT = 4;

/** 解析本次检索应返回的图片张数 */
export function resolveImageFetchCount(text) {
  const msg = String(text || "");
  if (wantsImageZipBundle(msg)) return 20;
  const explicit = parseRequestedImageCount(msg);
  if (explicit > 0) return explicit;
  return DEFAULT_IMAGE_FETCH_COUNT;
}

export function wantsMultiImageFetch(text) {
  return true;
}

export function wantsImageZipBundle(text) {
  return /压缩包|素材包|图包|整理成.*包|打包/.test(String(text || ""));
}

/** 酒店类英文检索词（如 南京滨江希尔顿 → Hilton Nanjing） */
export function buildHotelEnglishVariants(subject) {
  const core = stripImageSearchNoise(subject);
  if (!core) return [];
  const city = core.match(CN_CITIES)?.[0] || "";
  const out = [];
  for (const [re, en] of HOTEL_BRAND_EN) {
    if (re.test(core)) {
      if (city) out.push(`${en} ${city}`, `${en} ${city} hotel`);
      out.push(`${en} ${core.replace(re, "").trim()}`.replace(/\s+/g, " ").trim());
    }
  }
  return [...new Set(out.filter((v) => v.length >= 4))];
}

/** 从搜索词中去掉「图片/高清」等噪音，图搜引擎不需要这些词 */
export function stripImageSearchNoise(raw) {
  return String(raw || "")
    .replace(/(?:的)?(?:相关)?(?:高清)?(?:宣传)?(?:配图|图片|照片|图像|素材|图集|图包)/gi, " ")
    .replace(/(?:^|\s)(?:门店照片|门店环境|环境|宣传|官方|品牌)(?:\s|$)/gi, " ")
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
  } else if (isScenicLikeSubject(core)) {
    variants.push(`${core} 实景`, `${core} 高清`, `${core} 风景`, `${core} 照片`);
  } else {
    variants.push(
      core,
      `${core} 宣传`,
      `${core} 门店`,
      `${core} logo`,
      `${core} 官方`,
      `${core} 品牌`,
    );
    if (isHotelLikeSubject(core)) {
      variants.push(
        `${core}酒店`,
        `${core}酒店 外观`,
        `${core} 外景`,
        `${core} 实景`,
        `${core} 大堂`,
        ...buildHotelEnglishVariants(core),
      );
    } else if (/ktv|KTV|酒吧|餐厅|咖啡|奶茶|门店|店/i.test(core)) {
      variants.push(`${core} 门店照片`, `${core} 环境`, `${core} KTV`, `${core} 团购`);
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
  const tokens = expandSubjectTokens(core);
  const { brand } = splitStoreBrand(core);
  const primary = (isStoreLikeSubject(core) && brand) || tokens.sort((a, b) => b.length - a.length)[0] || core;
  return { primary, tokens: [...new Set(tokens)] };
}

/** 标题是否与检索主体相关（过滤「娱乐无界」「KTV七店通用」等误命中） */
export function titleMatchesSubject(title, subject) {
  const { primary, tokens } = coreSubjectTokens(subject);
  if (!primary || primary.length < 2) return true;
  const hay = String(title || "").toLowerCase();
  if (hay.includes(primary.toLowerCase())) return true;

  const zhTokens = tokens.filter((t) => /[\u4e00-\u9fff]/.test(t) && t.length >= 2);
  if (zhTokens.some((t) => t.length >= 3 && hay.includes(t.toLowerCase()))) return true;
  if (zhTokens.some((t) => t.length >= 2 && hay.includes(t.toLowerCase())) && /ktv|KTV/.test(subject)) {
    return true;
  }

  if (isHotelLikeSubject(subject)) {
    const hits = zhTokens.filter((t) => hay.includes(t.toLowerCase()));
    if (hits.length >= 2) return true;
    for (const [, en] of HOTEL_BRAND_EN) {
      if (hay.includes(en.toLowerCase())) return true;
    }
  }

  if (isStoreLikeSubject(subject)) {
    const { brand } = splitStoreBrand(String(subject || ""));
    if (brand && hay.includes(brand.toLowerCase())) return true;
    for (const [re, en] of STORE_BRAND_EN) {
      if (re.test(subject) && hay.includes(en.toLowerCase())) return true;
    }
    if (zhTokens.some((t) => t.length >= 2 && hay.includes(t.toLowerCase()))) return true;
  }

  return false;
}

/** 从搜索词提取用于图文匹配的核心关键词 */
export function extractSearchKeywords(query) {
  const core = stripImageSearchNoise(query);
  const { primary, tokens } = coreSubjectTokens(core);
  const keywords = [...new Set([primary, ...tokens].filter((k) => k && String(k).length >= 2))];
  return { core, primary, keywords };
}

function storeBrandHit(hay, query) {
  const { brand } = splitStoreBrand(stripImageSearchNoise(query));
  if (brand && hay.includes(brand.toLowerCase())) return true;
  for (const [re, en] of STORE_BRAND_EN) {
    if (re.test(query) && hay.includes(en.toLowerCase())) return true;
  }
  return false;
}

/** 文本中是否包含足够比例的检索关键词 */
export function textMatchesSearchKeywords(text, query) {
  const { primary, keywords } = extractSearchKeywords(query);
  const hay = String(text || "").toLowerCase();
  if (!hay.trim() || !keywords.length) return false;

  if (isStoreLikeSubject(query) && storeBrandHit(hay, query)) return true;

  if (primary && primary.length >= 2 && hay.includes(primary.toLowerCase())) return true;

  const hits = keywords.filter((k) => k.length >= 2 && hay.includes(String(k).toLowerCase()));
  const minHits = keywords.length <= 2 ? 1 : Math.max(1, Math.ceil(keywords.length * 0.34));
  return hits.length >= minHits;
}

/** 返回文本中命中的检索关键词 */
export function matchedSearchKeywords(text, query) {
  const { keywords } = extractSearchKeywords(query);
  const hay = String(text || "").toLowerCase();
  return keywords.filter((k) => k.length >= 2 && hay.includes(String(k).toLowerCase()));
}
