export type Tool = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: string;
  gradient: string;
  tag: string;
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
  },
  {
    id: "video-extract",
    title: "视频链接提取",
    description: "粘贴视频链接，快速解析并提取无水印资源，支持多平台。",
    href: "/tools/video-extract",
    icon: "▶",
    gradient: "from-cyan-500/20 to-blue-500/10",
    tag: "视频",
  },
  {
    id: "ai-video",
    title: "AI 生视频",
    description: "用文字描述生成创意短视频，多种风格模板随心选。",
    href: "/tools/ai-video",
    icon: "✦",
    gradient: "from-amber-500/20 to-orange-500/10",
    tag: "AI",
  },
  {
    id: "smart-cutout",
    title: "智能抠图",
    description: "AI 自动识别主体并去除背景，导出透明 PNG，适合封面与素材。",
    href: "/tools/smart-cutout",
    icon: "◈",
    gradient: "from-emerald-500/20 to-teal-500/10",
    tag: "图像",
  },
  {
    id: "image-sharpen",
    title: "图片变清晰",
    description: "AI 智能增强模糊照片，修复细节、提升分辨率，适合老图与截图。",
    href: "/tools/image-sharpen",
    icon: "◇",
    gradient: "from-sky-500/20 to-indigo-500/10",
    tag: "图像",
  },
  {
    id: "image-compress",
    title: "压缩图片",
    description: "在保持视觉质量的前提下缩小体积，支持 JPG、PNG、WebP 批量处理。",
    href: "/tools/image-compress",
    icon: "◐",
    gradient: "from-lime-500/20 to-green-500/10",
    tag: "图像",
  },
  {
    id: "ai-chat",
    title: "AI 角色聊天",
    description: "与多种人设 AI 对话，获取创意灵感、脚本建议与运营思路。",
    href: "/tools/ai-chat",
    icon: "◎",
    gradient: "from-purple-500/20 to-violet-500/10",
    tag: "AI",
  },
  {
    id: "hot-trends",
    title: "热点中心",
    description: "聚合抖音、小红书实时热点与爆款话题，助你快速跟上流量趋势。",
    href: "/tools/hot-trends",
    icon: "◉",
    gradient: "from-red-500/20 to-orange-500/10",
    tag: "运营",
  },
  {
    id: "media-search",
    title: "影视资源搜索",
    description: "快速检索电影、剧集、综艺资源信息，聚合多源结果便于对比筛选。",
    href: "/tools/media-search",
    icon: "🎬",
    gradient: "from-blue-500/20 to-indigo-500/10",
    tag: "影视",
  },
  {
    id: "spider-builder",
    title: "制作爬虫",
    description: "可视化配置抓取规则，生成爬虫脚本模板，支持定时任务与数据导出。",
    href: "/tools/spider-builder",
    icon: "🕷",
    gradient: "from-slate-500/20 to-zinc-500/10",
    tag: "开发",
  },
  {
    id: "assets",
    title: "我的素材库",
    description: "集中管理音频、视频与图片素材，分类检索，随时调用。",
    href: "/tools/assets",
    icon: "▣",
    gradient: "from-rose-500/20 to-pink-500/10",
    tag: "管理",
  },
];

export function getToolById(id: string): Tool | undefined {
  return tools.find((t) => t.id === id);
}
