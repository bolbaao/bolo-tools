export type BentoSize = "hero" | "wide" | "tall" | "default";

export type Tool = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: string;
  gradient: string;
  tag: string;
  bento: BentoSize;
  demoHint: string;
};

export const tools: Tool[] = [
  {
    id: "music-convert",
    title: "音乐转格式",
    description: "将 MP3、WAV、FLAC 等音频一键转换为所需格式，保持高品质输出。",
    href: "/tools/music-convert",
    icon: "♪",
    gradient: "from-violet-500/20 to-fuchsia-500/10",
    tag: "音频",
    bento: "default",
    demoHint: "上传音频 → 选择格式 → 一键转换下载",
  },
  {
    id: "video-extract",
    title: "视频链接提取",
    description: "抖音、B 站、YouTube、X、Telegram、Instagram 等；多清晰度与本页直接下载。",
    href: "/tools/video-extract",
    icon: "▶",
    gradient: "from-cyan-500/20 to-blue-500/10",
    tag: "视频",
    bento: "default",
    demoHint: "主流社媒链接 → 解析下载",
  },
  {
    id: "ai-video",
    title: "AI 生视频",
    description: "用文字描述生成创意短视频，多种风格模板随心选。",
    href: "/tools/ai-video",
    icon: "✦",
    gradient: "from-amber-500/20 to-orange-500/10",
    tag: "AI",
    bento: "wide",
    demoHint: "输入描述 → AI 生成创意短视频",
  },
  {
    id: "smart-cutout",
    title: "智能抠图",
    description: "AI 自动识别主体并去除背景，导出透明 PNG，适合封面与素材。",
    href: "/tools/smart-cutout",
    icon: "◈",
    gradient: "from-emerald-500/20 to-teal-500/10",
    tag: "图像",
    bento: "default",
    demoHint: "上传图片 → AI 自动抠出透明背景",
  },
  {
    id: "image-sharpen",
    title: "图片变清晰",
    description: "AI 智能增强模糊照片，修复细节、提升分辨率，适合老图与截图。",
    href: "/tools/image-sharpen",
    icon: "◇",
    gradient: "from-sky-500/20 to-indigo-500/10",
    tag: "图像",
    bento: "tall",
    demoHint: "智能锐化，模糊照片秒变清晰",
  },
  {
    id: "image-compress",
    title: "压缩图片",
    description: "在保持视觉质量的前提下缩小体积，支持 JPG、PNG、WebP 批量处理。",
    href: "/tools/image-compress",
    icon: "◐",
    gradient: "from-lime-500/20 to-green-500/10",
    tag: "图像",
    bento: "default",
    demoHint: "拖拽上传 → 调节质量 → 压缩导出",
  },
  {
    id: "ai-chat",
    title: "闲聊对话",
    description: "轻松唠嗑、吐槽日常、分享心情，像和朋友聊天一样自然随意。",
    href: "/tools/ai-chat",
    icon: "◎",
    gradient: "from-purple-500/20 to-violet-500/10",
    tag: "AI",
    bento: "hero",
    demoHint: "像朋友一样轻松闲聊",
  },
  {
    id: "hot-trends",
    title: "热点中心",
    description: "聚合抖音、小红书实时热点与爆款话题，助你快速跟上流量趋势。",
    href: "/tools/hot-trends",
    icon: "◉",
    gradient: "from-red-500/20 to-orange-500/10",
    tag: "运营",
    bento: "wide",
    demoHint: "抖音 / 小红书实时热点榜",
  },
  {
    id: "media-search",
    title: "影视资源搜索",
    description: "快速检索电影、剧集、综艺资源信息，聚合多源结果便于对比筛选。",
    href: "/tools/media-search",
    icon: "🎬",
    gradient: "from-blue-500/20 to-indigo-500/10",
    tag: "影视",
    bento: "wide",
    demoHint: "搜索片名 → TMDB 影视数据库",
  },
  {
    id: "spider-builder",
    title: "小蜘蛛爬虫",
    description: "选场景、填网址、一键抓取——像玩游戏一样把网页数据收进篮子，还能导出 JSON/CSV。",
    href: "/tools/spider-builder",
    icon: "🕷",
    gradient: "from-slate-500/20 to-zinc-500/10",
    tag: "开发",
    bento: "default",
    demoHint: "选场景 → 出发抓取 → 导出收获",
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

/** 分类展示顺序（不含「全部」） */
const CATEGORY_ORDER = ["AI", "图像", "视频", "音频", "运营", "影视", "开发"];

export type ToolCategory = {
  id: string;
  label: string;
  count: number;
};

export function getToolCategories(): ToolCategory[] {
  const counts = new Map<string, number>();
  for (const tool of tools) {
    counts.set(tool.tag, (counts.get(tool.tag) ?? 0) + 1);
  }

  const tagged = CATEGORY_ORDER.filter((tag) => counts.has(tag)).map((tag) => ({
    id: tag,
    label: tag,
    count: counts.get(tag)!,
  }));

  return [{ id: "all", label: "全部", count: tools.length }, ...tagged];
}

export function filterToolsByCategory(categoryId: string): Tool[] {
  if (categoryId === "all") return tools;
  return tools.filter((t) => t.tag === categoryId);
}
