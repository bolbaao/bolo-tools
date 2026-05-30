import { homepageFeaturedToolIds } from "@/lib/featured-tools";

export type BentoSize = "hero" | "wide" | "tall" | "default";

export type Tool = {
  id: string;
  title: string;
  description: string;
  href: string;
  gradient: string;
  tag: string;
  bento: BentoSize;
  demoHint: string;
  /** 首页独立展示，不出现在下方工具网格 */
  homeFeatured?: boolean;
};

export const tools: Tool[] = [
  {
    id: "music-convert",
    title: "音乐工坊",
    description: "云音乐本地解锁与高品质格式互转，批量队列、进度可视、一键 ZIP。",
    href: "/tools/music-convert",
    gradient: "from-violet-500/20 to-fuchsia-500/10",
    tag: "音频",
    bento: "default",
    demoHint: "拖入曲目 · 选输出格式 · 批量转换下载",
  },
  {
    id: "video-extract",
    title: "视频链接提取",
    description: "抖音、B 站、YouTube、X、Telegram、Instagram 等；多清晰度与本页直接下载。",
    href: "/tools/video-extract",
    gradient: "from-cyan-500/20 to-blue-500/10",
    tag: "视频",
    bento: "default",
    demoHint: "主流社媒链接 → 解析下载",
  },
  {
    id: "image-studio",
    title: "图像工坊",
    description: "压缩、变清晰、抠图本地处理；xAI Grok Imagine 文生图。",
    href: "/tools/image-studio",
    gradient: "from-sky-500/20 via-violet-500/15 to-emerald-500/10",
    tag: "图像",
    bento: "tall",
    demoHint: "压缩 · 变清晰 · 抠图 · AI 生图",
  },
  {
    id: "ai-chat",
    title: "AI 对话",
    description: "轻松唠嗑、吐槽日常；需要时还能当智能助手，帮你打开工具并预填。",
    href: "/tools/ai-chat",
    gradient: "from-purple-500/20 to-violet-500/10",
    tag: "AI",
    bento: "default",
    demoHint: "像朋友一样聊天，也能帮你操作工具",
    homeFeatured: true,
  },
  {
    id: "ai-search",
    title: "AI 全网搜索",
    description: "检索全网信息，AI 综合多来源生成带引用的精准答案。",
    href: "/tools/ai-search",
    gradient: "from-indigo-500/20 via-violet-500/15 to-blue-500/10",
    tag: "AI",
    bento: "wide",
    demoHint: "提问 → 全网检索 → AI 摘要与来源",
  },
  {
    id: "hot-trends",
    title: "热点中心",
    description: "聚合抖音、小红书实时热点与爆款话题，助你快速跟上流量趋势。",
    href: "/tools/hot-trends",
    gradient: "from-red-500/20 to-orange-500/10",
    tag: "运营",
    bento: "wide",
    demoHint: "抖音 / 小红书实时热点榜",
  },
  {
    id: "media-search",
    title: "影视搜索",
    description: "多源并行检索片名，聚合豆瓣与 TMDB，一键复制资源链接包。",
    href: "/tools/media-search",
    gradient: "from-blue-500/20 to-indigo-500/10",
    tag: "影视",
    bento: "wide",
    demoHint: "多源检索 → 链接包 → 一键复制",
  },
  {
    id: "media-download",
    title: "影视资源下载",
    description: "多源并行检索片名，聚合网盘下载链接，百度/迅雷/夸克/阿里一键复制。",
    href: "/tools/media-download",
    gradient: "from-amber-500/20 to-orange-500/10",
    tag: "影视",
    bento: "default",
    demoHint: "输入片名 → 多源检索 → 复制网盘链接",
  },
  {
    id: "spider-builder",
    title: "小蜘蛛爬虫",
    description: "选场景、填网址、一键抓取——像玩游戏一样把网页数据收进篮子，还能导出 JSON/CSV。",
    href: "/tools/spider-builder",
    gradient: "from-slate-500/20 to-zinc-500/10",
    tag: "开发",
    bento: "default",
    demoHint: "选场景 → 出发抓取 → 导出收获",
  },
  {
    id: "doc-convert",
    title: "文档转换",
    description: "PDF 与 Word 互转、PDF 导出图片、多张图片合并 PDF，本地处理更安心。",
    href: "/tools/doc-convert",
    gradient: "from-teal-500/20 to-emerald-500/10",
    tag: "文档",
    bento: "default",
    demoHint: "选类型 → 上传文件 → 下载结果",
  },
  {
    id: "subtitle-workshop",
    title: "字幕工坊",
    description: "语音转文字（字幕）、提取内嵌字幕轨、SRT 时间平移与 VTT 导出。",
    href: "/tools/subtitle-workshop",
    gradient: "from-cyan-500/20 to-teal-500/10",
    tag: "视频",
    bento: "default",
    demoHint: "转写 · 提取 · 编辑导出",
  },
  {
    id: "gif-maker",
    title: "GIF 动图",
    description: "从视频截取片段生成 GIF，可调起始时间、时长、帧率与宽度。",
    href: "/tools/gif-maker",
    gradient: "from-amber-500/20 to-orange-500/10",
    tag: "视频",
    bento: "default",
    demoHint: "上传视频 → 调参数 → 下载 GIF",
  },
  {
    id: "text-toolbox",
    title: "文本工具箱",
    description: "字数统计、去重行、JSON 格式化、Markdown 预览，浏览器本地完成。",
    href: "/tools/text-toolbox",
    gradient: "from-slate-500/20 to-zinc-500/10",
    tag: "文档",
    bento: "default",
    demoHint: "统计 · 去重 · JSON · MD",
  },
];

export const bentoClass: Record<BentoSize, string> = {
  hero: "sm:col-span-2 sm:row-span-2 lg:col-span-2 lg:row-span-2",
  wide: "sm:col-span-2 lg:col-span-2",
  tall: "sm:row-span-2 lg:row-span-2",
  default: "",
};

export function getToolById(id: string): Tool | undefined {
  return tools.find((t) => t.id === id);
}

/** 不出现在实用工具箱 */
const TOOLKIT_EXTRA_EXCLUDED = ["ai-chat", "media-search"] as const;

const toolkitExcludedIds = new Set<string>([
  ...homepageFeaturedToolIds,
  ...TOOLKIT_EXTRA_EXCLUDED,
]);

export function getToolkitTools(): Tool[] {
  return tools.filter((t) => !toolkitExcludedIds.has(t.id));
}

export function getGridTools(): Tool[] {
  return getToolkitTools();
}

/** 分类展示顺序（不含「全部」） */
const CATEGORY_ORDER = ["AI", "图像", "视频", "音频", "文档", "运营", "影视", "开发"];

export type ToolCategory = {
  id: string;
  label: string;
  count: number;
};

export function getToolCategories(): ToolCategory[] {
  const grid = getGridTools();
  const counts = new Map<string, number>();
  for (const tool of grid) {
    counts.set(tool.tag, (counts.get(tool.tag) ?? 0) + 1);
  }

  const tagged = CATEGORY_ORDER.filter((tag) => counts.has(tag)).map((tag) => ({
    id: tag,
    label: tag,
    count: counts.get(tag)!,
  }));

  return [{ id: "all", label: "全部", count: grid.length }, ...tagged];
}

export function filterToolsByCategory(categoryId: string): Tool[] {
  const grid = getGridTools();
  if (categoryId === "all") return grid;
  return grid.filter((t) => t.tag === categoryId);
}
