export type SpiderPreset = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  listSelector: string;
  itemSelector: string;
  sampleUrl: string;
  tip: string;
};

export const SPIDER_PRESETS: SpiderPreset[] = [
  {
    id: "headlines",
    emoji: "📰",
    title: "新闻标题",
    description: "从资讯、博客列表页整理出文章标题和链接",
    listSelector: "article, li, .item, .story, tr",
    itemSelector: "h2, h3, h4, .title, a",
    sampleUrl: "https://news.ycombinator.com",
    tip: "适合资讯站、博客列表、论坛帖子",
  },
  {
    id: "links",
    emoji: "🔗",
    title: "全站链接",
    description: "把页面里能点的链接都整理出来，方便盘点",
    listSelector: "body",
    itemSelector: "a",
    sampleUrl: "https://example.com",
    tip: "适合盘点导航、外链、资源页",
  },
  {
    id: "quotes",
    emoji: "💬",
    title: "列表语录",
    description: "把排行榜、名言、商品名等一列文字批量摘下来",
    listSelector: ".quote, li, .item, .product, div.quote",
    itemSelector: ".text, span, p, a",
    sampleUrl: "https://quotes.toscrape.com",
    tip: "示例站 quotes.toscrape.com 专为练习爬虫设计",
  },
  {
    id: "cards",
    emoji: "🃏",
    title: "卡片区块",
    description: "从电商、图书等卡片列表里提取标题信息",
    listSelector: ".card, .box, section, .product, .post",
    itemSelector: "h2, h3, .name, .heading, a",
    sampleUrl: "https://books.toscrape.com",
    tip: "适合电商、图书、课程列表页",
  },
];

export const SPIDER_MOODS = {
  idle: { emoji: "🕷️", line: "选好场景，派小蜘蛛出发吧" },
  ready: { emoji: "🕸️", line: "网已铺好，随时可以抓取" },
  crawling: { emoji: "🕷️", line: "小蜘蛛正在织网…" },
  success: { emoji: "🎉", line: "满载而归！" },
  empty: { emoji: "😶", line: "这次没有抓到内容，换个场景或网址试试？" },
  error: { emoji: "💫", line: "蜘蛛绊了一跤，检查一下网址" },
} as const;
