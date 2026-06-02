import axios from "axios";

export const HOT_FALLBACK = [
  "星际穿越",
  "庆余年",
  "鬼灭之刃",
  "奥本海默",
  "繁花",
  "流浪地球",
  "千与千寻",
  "盗梦空间",
];

function normTitle(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[：:·\-\s]/g, "");
}

async function fetchDouban(query) {
  try {
    const { data } = await axios.get("https://movie.douban.com/j/subject_suggest", {
      params: { q: query },
      timeout: 8000,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PineappleToolbox/1.0)",
        Referer: "https://movie.douban.com/",
      },
    });
    return data || [];
  } catch {
    return [];
  }
}

function buildResourceLinks(item) {
  const q = encodeURIComponent(`${item.title} ${item.year !== "—" ? item.year : ""}`.trim());
  const links = [];

  if (item.doubanUrl) {
    links.push({ id: "douban", label: "豆瓣条目", url: item.doubanUrl, kind: "meta" });
  }

  links.push(
    {
      id: "bilibili",
      label: "B站搜索",
      url: `https://search.bilibili.com/all?keyword=${q}`,
      kind: "search",
    },
    {
      id: "youtube",
      label: "YouTube 搜索",
      url: `https://www.youtube.com/results?search_query=${q}`,
      kind: "search",
    },
    {
      id: "iqiyi",
      label: "爱奇艺搜索",
      url: `https://so.iqiyi.com/so/q_${q}`,
      kind: "search",
    },
  );

  const lines = [
    `${item.title}${item.year !== "—" ? ` (${item.year})` : ""}`,
    item.type ? `类型：${item.type}` : "",
    item.score ? `评分：${item.score}` : "",
    "",
    ...links.map((l) => `${l.label}：${l.url}`),
  ].filter(Boolean);

  return { links, copyText: lines.join("\n") };
}

function mapDoubanRow(item) {
  return {
    title: item.title,
    year: String(item.year || ""),
    type: item.type === "tv" ? "剧集" : "电影",
    doubanUrl: item.url || `https://movie.douban.com/subject/${item.id}/`,
    poster: item.img || null,
    score: item.sub_title?.match(/[\d.]+/)?.[0] || null,
    overview: "",
  };
}

/** 豆瓣检索、去重并附带资源链接 */
export async function searchMedia(query, limit = 16) {
  const raw = await fetchDouban(query);
  const seen = new Set();
  const results = [];

  for (const row of raw) {
    const base = mapDoubanRow(row);
    const key = `${normTitle(base.title)}|${base.year || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const item = {
      key,
      title: base.title,
      year: base.year || "—",
      type: base.type,
      poster: base.poster,
      score: base.score,
      overview: base.overview,
      doubanUrl: base.doubanUrl,
    };
    const { links, copyText } = buildResourceLinks(item);
    results.push({ ...item, links, copyText });
    if (results.length >= limit) break;
  }

  return results;
}
