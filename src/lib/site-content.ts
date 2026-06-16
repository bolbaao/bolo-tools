import { getToolById, type Tool } from "@/lib/tools";

/** 管理员 · 站点副标题 */
export const SITE_TAGLINE = "创作者的一站式工具箱 · 音乐 · 视频 · 图像 · AI 创作";

/** 用户 · 站点副标题 */
export const USER_SITE_TAGLINE = "做图片、做视频、写文案，打开浏览器就能用";

/** 管理员 · 首屏价值主张 */
export const SITE_VALUE_PROPS = [
  { icon: "⚡", title: "打开即用", desc: "浏览器里完成，无需安装客户端" },
  { icon: "🧰", title: "20+ 实用工具", desc: "下载、转换、写作、热点一站聚合" },
  { icon: "✦", title: "AI 帮你上手", desc: "对话选工具、预填参数，少摸索" },
] as const;

export type SiteValueProp = {
  icon: string;
  title: string;
  desc: string;
};

/** 用户 · 首屏价值主张 */
export const USER_SITE_VALUE_PROPS: readonly SiteValueProp[] = [
  { icon: "⚡", title: "打开就能用", desc: "不用装软件，浏览器里直接搞定" },
  { icon: "🧰", title: "工具很齐全", desc: "下载、转换、写作、追热点都在这" },
  { icon: "✦", title: "不会也能问", desc: "跟 AI 说说想做什么，它帮你找工具" },
];

/** 首页精选工具 */
export const FEATURED_TOOL_IDS = [
  "video-extract",
  "image-studio",
  "ai-writer",
  "subtitle-workshop",
  "hot-trends",
  "mlsharp-3d",
] as const;

export function getFeaturedTools(): Tool[] {
  return FEATURED_TOOL_IDS.map((id) => getToolById(id)).filter(Boolean) as Tool[];
}

/** 管理员 · 首页对话快捷示例 */
export const QUICK_CHAT_PROMPTS = [
  "帮我把这条抖音链接下载下来",
  "写一条小红书种草文案",
  "看看今天抖音有什么热点",
  "给这段口播稿配画面并配音",
  "把 PDF 转成 Word",
  "压缩这张图片并抠出人物",
] as const;

/** 用户 · 首页对话快捷示例 */
export const USER_QUICK_CHAT_PROMPTS = [
  "帮我把这条抖音视频下载下来",
  "写一条小红书种草文案",
  "今天有什么热点可以跟",
  "给口播稿配上画面和配音",
  "把这份 PDF 转成 Word",
  "帮我把人像抠出来换白底",
] as const;

/** 管理员 · 各工具页亮点标签 */
export const TOOL_HIGHLIGHTS: Record<string, string[]> = {
  "music-convert": ["多格式互转", "批量打包", "本机 ffmpeg"],
  "video-extract": ["14+ 平台", "多清晰度", "本页直接下载"],
  "image-studio": ["AI 消除 · OCR 提字", "证件照 · 去水印", "压缩 · 抠图 · 生图"],
  "mlsharp-3d": ["单图生成 3D", "可调精细度", "导出主流格式"],
  memory: ["跨工具同步", "个人偏好", "随时编辑"],
  "ai-search": ["全网检索", "网页 + 图片 + 视频", "摘要 + 来源"],
  "ai-writer": ["工作报告 · 简历", "文档速读", "扩写润色"],
  storyboard: ["AI 拆分镜头", "逐镜出图", "口播与画面"],
  "social-publish": ["多平台分发", "少重复粘贴", "按平台提示"],
  "hot-trends": ["抖音 · 小红书", "实时榜单", "话题详情"],
  "media-download": ["片名检索", "网盘资源", "一键复制"],
  "web-video-extract": ["扫描网页", "直链下载", "嵌入播放器"],
  "doc-convert": ["PDF 合并拆分", "PDF 压缩", "PDF ↔ Word"],
  "subtitle-workshop": ["语音转字幕", "提取硬字幕", "在线编辑导出"],
  "gif-maker": ["视频截 GIF", "时长可调", "体积可控"],
  "text-toolbox": ["字数统计", "JSON 整理", "Markdown 预览"],
};

/** 用户 · 各工具页亮点标签 */
export const USER_TOOL_HIGHLIGHTS: Record<string, string[]> = {
  "music-convert": ["多格式互转", "多首批量", "打包下载"],
  "video-extract": ["多平台支持", "多种清晰度", "本页直接下载"],
  "image-studio": ["抠图换背景", "去水印", "AI 生图美化"],
  "mlsharp-3d": ["照片转 3D", "可调精细度", "下载即用"],
  memory: ["记住你的偏好", "各工具通用", "随时改"],
  "ai-search": ["全网帮你搜", "网页·图片·视频", "摘要带出处"],
  "ai-writer": ["多种写作模式", "润色扩写", "配合记忆库"],
  storyboard: ["自动拆镜头", "每镜配图", "打包下载"],
  "social-publish": ["多平台分发", "少重复粘贴", "按平台提示"],
  "hot-trends": ["抖音 · 小红书", "实时热榜", "快速跟话题"],
  "media-download": ["按名称搜索", "找到就复制", "省事"],
  "web-video-extract": ["粘贴网页", "自动找视频", "本页下载"],
  "doc-convert": ["PDF 与 Word", "PDF 转图片", "多图合成 PDF"],
  "subtitle-workshop": ["自动加字幕", "提取原有字幕", "改完导出"],
  "gif-maker": ["视频做动图", "时长可调", "体积可控"],
  "text-toolbox": ["字数统计", "文本整理", "Markdown 预览"],
};

/** 用户 · 工具一句话介绍（管理员沿用 tools.ts 原文） */
export const USER_TOOL_DESCRIPTIONS: Record<string, string> = {
  "music-convert": "各平台下载的歌曲，一键转成 MP3、FLAC 等常用格式，多首可打包带走。",
  "video-extract": "复制抖音、B 站等分享链接，选好清晰度，在本页直接下载。",
  "image-studio": "压缩、抠图、换背景、去水印、人像美化、AI 生图——图片常用处理都在这。",
  "mlsharp-3d": "上传一张照片，生成可旋转查看的 3D 模型，下载后就能用。",
  memory: "记下你的常用信息和偏好，各工具里都能保持一致。",
  "ai-search": "有问题直接问，可搜全网网页、图片、视频或社媒内容，整理摘要并附来源链接。",
  "ai-writer": "写文章、改写法、润色、扩写、写摘要、社媒文案、邮件或翻译。",
  storyboard: "输入视频主题或脚本，自动拆分分镜并为每个镜头生成配图。",
  "social-publish": "同一条视频或文案，尽量帮你发到多个平台，少重复粘贴。",
  "hot-trends": "看看抖音、小红书上正在火什么，按榜单浏览，快速跟上话题。",
  "media-download": "输入片名搜索资源，找到链接一键复制。",
  "web-video-extract": "粘贴网页链接，自动扫描页面中的视频并下载。",
  "doc-convert": "PDF 与 Word 互转、PDF 转图片、多张图片合成 PDF，浏览器里就能完成。",
  "subtitle-workshop": "给视频或音频自动加字幕，也能提取原有字幕，改好后导出。",
  "gif-maker": "从视频里截一段做成动图，开始时间、长短和大小都能自己调。",
  "text-toolbox": "统计字数、去掉重复行、整理文本、预览 Markdown，粘贴就能用。",
};

export function getSiteTagline(isAdmin: boolean): string {
  return isAdmin ? SITE_TAGLINE : USER_SITE_TAGLINE;
}

export function getSiteValueProps(isAdmin: boolean): readonly SiteValueProp[] {
  return isAdmin ? (SITE_VALUE_PROPS as readonly SiteValueProp[]) : USER_SITE_VALUE_PROPS;
}

export function getQuickChatPrompts(isAdmin: boolean): readonly string[] {
  return isAdmin ? QUICK_CHAT_PROMPTS : USER_QUICK_CHAT_PROMPTS;
}

export function getToolHighlights(toolId: string, isAdmin = false): string[] {
  const map = isAdmin ? TOOL_HIGHLIGHTS : USER_TOOL_HIGHLIGHTS;
  return map[toolId] ?? [];
}

export function getToolDescription(toolId: string, isAdmin = false): string {
  const tool = getToolById(toolId);
  if (!tool) return "";
  if (isAdmin) return tool.description;
  return USER_TOOL_DESCRIPTIONS[toolId] ?? tool.description;
}

/** 工具页 Hero 副标题（较 tools.ts 描述更短、偏 landing 向） */
export const TOOL_HERO_SUBTITLES: Record<string, string> = {
  "ai-writer": "智能写作，激发灵感，高效创作",
  storyboard: "AI 帮你把视频拆成分镜，并自动生成每个镜头的配图",
  "image-studio": "AI 图像处理，创意无限",
  "mlsharp-3d": "从文本或图像生成 3D 模型",
  "video-extract": "提取视频链接，支持多平台",
  "subtitle-workshop": "AI 语音识别，快速生成字幕",
  "gif-maker": "轻松制作 GIF 动图",
  memory: "你的个人知识库，随时调用",
  "ai-search": "基于全网数据和 AI 智能，为你提供准确、全面的搜索结果",
  "music-convert": "各平台歌曲一键转格式，多首打包下载",
  "social-publish": "同一条内容，尽量帮你发到多个平台",
  "hot-trends": "看看抖音、小红书上正在火什么",
  "media-download": "输入名称搜索，找到链接一键复制",
  "web-video-extract": "粘贴网页链接，扫描并下载页面中的视频",
  "doc-convert": "PDF 与 Word 互转，浏览器里就能完成",
  "text-toolbox": "统计字数、整理文本，粘贴就能用",
};

export function getToolHeroSubtitle(toolId: string, isAdmin = false): string {
  if (TOOL_HERO_SUBTITLES[toolId]) return TOOL_HERO_SUBTITLES[toolId];
  return getToolDescription(toolId, isAdmin);
}

export function getToolDialogPlaceholder(toolId: string, title: string, isAdmin = false): string {
  if (isAdmin) {
    return `描述你想用「${title}」做什么，AI 可帮你预填并执行…`;
  }
  return `说说你想用「${title}」做什么，我来帮你…`;
}

type ImageStudioTab =
  | "compress"
  | "sharpen"
  | "cutout"
  | "bgreplace"
  | "watermark"
  | "erase"
  | "ocr"
  | "idphoto"
  | "beautify"
  | "edit"
  | "generate";

/** 图像工坊底部说明 */
export function getImageStudioFooterHint(
  tab: ImageStudioTab,
  bgMode: "color" | "upload" | "ai",
  isAdmin: boolean,
): string {
  if (isAdmin) {
    if (tab === "generate") return "AI 生图：输入画面描述，一键生成并下载";
    if (tab === "beautify") return "人像美化：上传人像照片，一键智能美颜，需配置 ARK_API_KEY";
    if (tab === "edit") return "AI 修图：上传图片并描述修改需求，需配置 ARK_API_KEY";
    if (tab === "bgreplace") {
      return bgMode === "ai"
        ? "AI 换背景：描述目标场景，需配置 ARK_API_KEY"
        : "换背景：本地智能抠图 + 合成，纯色/上传背景图无需 API Key";
    }
    if (tab === "watermark") {
      return "去水印：AI 智能修复遮挡区域，需配置 ARK_API_KEY · 请仅处理你有权使用的图片";
    }
    if (tab === "erase") return "AI 消除：智能去除路人、杂物等，需配置 ARK_API_KEY";
    if (tab === "ocr") return "提文字：OCR 识别图中文字，需配置 ARK_VISION_API_KEY 或 ARK_API_KEY";
    if (tab === "idphoto") return "证件照：本地抠图 + 标准尺寸输出，无需 API Key";
    return "压缩、变清晰、抠图：上传图片即可处理并下载";
  }

  if (tab === "generate") return "描述想要的画面，一键生成并下载";
  if (tab === "beautify") return "上传人像照片，一键智能美颜";
  if (tab === "edit") return "上传图片，告诉 AI 想怎么改就行";
  if (tab === "bgreplace") {
    return bgMode === "ai"
      ? "描述想要的背景场景，AI 帮你自然换背景"
      : "纯色或上传背景图，本地抠图合成，更快也更隐私";
  }
  if (tab === "watermark") return "智能去除角标与水印，请仅处理你有权使用的图片";
  if (tab === "erase") return "智能消除路人、杂物，请仅处理你有权使用的图片";
  if (tab === "ocr") return "从截图、海报中提取文字，可复制使用";
  if (tab === "idphoto") return "一键生成标准证件照，本地处理更隐私";
  return "上传图片即可处理，本地完成的步骤不会上传";
}

/** 公开 SEO 等场景始终用用户向文案 */
export const PUBLIC_SITE_TAGLINE = USER_SITE_TAGLINE;
