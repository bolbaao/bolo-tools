import { homepageFeaturedToolIds } from "@/lib/featured-tools";

export type BentoSize = "hero" | "wide" | "tall" | "default";

export type Tool = {
  id: string;
  title: string;
  /** 面向用户的一句话介绍 */
  description: string;
  /** 使用步骤（面向用户） */
  usageGuide: string;
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
    description: "把各平台下载的歌曲转成 MP3、FLAC 等常用格式，支持多首一起转、打包下载。",
    usageGuide: "拖入或选择音乐文件 → 选好目标格式 → 开始转换 → 单首下载或打包带走",
    href: "/tools/music-convert",
    gradient: "from-violet-500/20 to-fuchsia-500/10",
    tag: "音频",
    bento: "default",
    demoHint: "上传曲目 · 选格式 · 批量下载",
  },
  {
    id: "video-extract",
    title: "视频链接提取",
    description: "复制分享链接粘贴进来，帮你解析并下载，多种清晰度可选。",
    usageGuide: "复制视频分享链接 → 粘贴并解析 → 选好清晰度 → 在本页下载",
    href: "/tools/video-extract",
    gradient: "from-cyan-500/20 to-blue-500/10",
    tag: "视频",
    bento: "default",
    demoHint: "粘贴链接 → 解析 → 选清晰度下载",
  },
  {
    id: "image-studio",
    title: "图像工坊",
    description: "让图片更小、更清晰，一键抠图、美化人像，还能用文字描述生成新图。",
    usageGuide: "选好要做的效果 → 上传图片或输入描述 → 处理完成即可下载",
    href: "/tools/image-studio",
    gradient: "from-sky-500/20 via-violet-500/15 to-emerald-500/10",
    tag: "图像",
    bento: "tall",
    demoHint: "选效果 · 上传或描述 · 下载成品",
  },
  {
    id: "ai-chat",
    title: "AI 对话",
    description: "像和朋友聊天一样问问题、发图片；想下载视频、搜片或写作时，直接说需求就行。",
    usageGuide: "输入想说的话即可；有具体任务时，用平常话说明你想做什么",
    href: "/tools/ai-chat",
    gradient: "from-purple-500/20 to-violet-500/10",
    tag: "AI",
    bento: "default",
    demoHint: "随便聊 · 也能帮你办事",
    homeFeatured: true,
  },
  {
    id: "memory",
    title: "开始使用",
    description: "记下你的偏好和常用信息，之后聊天会更懂你、前后更连贯。",
    usageGuide: "登录并验证邮箱 → 添加几条记忆 → 对话时会自动参考这些内容",
    href: "/tools/memory",
    gradient: "from-emerald-500/20 to-teal-500/10",
    tag: "AI",
    bento: "default",
    demoHint: "记下偏好 · 越聊越合拍",
  },
  {
    id: "ai-search",
    title: "AI 全网搜索",
    description: "有问题直接问，帮你搜遍全网并整理摘要，附带来源链接，查资料更省力。",
    usageGuide: "输入你的问题 → 选好搜索深度 → 阅读摘要并点开感兴趣的来源",
    href: "/tools/ai-search",
    gradient: "from-indigo-500/20 via-violet-500/15 to-blue-500/10",
    tag: "AI",
    bento: "wide",
    demoHint: "提问 → 看摘要 → 点开来源",
  },
  {
    id: "app-builder",
    title: "一键做 App",
    description: "说出你想做的小工具或页面，AI 帮你生成、预览并下载，也能配合 iPhone 快捷指令使用。",
    usageGuide: "选类型或模板 → 用话描述需求 → 生成后预览 → 满意就下载保存",
    href: "/tools/app-builder",
    gradient: "from-cyan-500/20 via-teal-500/15 to-emerald-500/10",
    tag: "AI",
    bento: "default",
    demoHint: "描述想法 → 生成 → 预览下载",
  },
  {
    id: "ai-writer",
    title: "AI 写作助手",
    description: "写文章、改写法、润色、扩写、写摘要、社媒文案、邮件或翻译，选对模式就能开始。",
    usageGuide: "选择写作模式 → 输入主题或粘贴原文 → 生成后复制或下载",
    href: "/tools/ai-writer",
    gradient: "from-indigo-500/20 via-blue-500/15 to-violet-500/10",
    tag: "AI",
    bento: "default",
    demoHint: "选模式 · 输入内容 · 复制或下载",
  },
  {
    id: "ai-workflow",
    title: "AI 工作流",
    description: "选一条创作流程，从成稿、社媒文案到视频脚本，可以一步步做，也能一键跑完。",
    usageGuide: "选择模板 → 填写主题或素材 → 逐步查看结果，或一键完成全流程",
    href: "/tools/ai-workflow",
    gradient: "from-purple-500/20 via-violet-500/15 to-fuchsia-500/10",
    tag: "AI",
    bento: "wide",
    demoHint: "选模板 · 填主题 · 串联出稿",
  },
  {
    id: "social-publish",
    title: "社媒一键分发",
    description: "同一条视频或文案，尽量帮你发到抖音等多个平台，少重复粘贴、少来回切换。",
    usageGuide: "上传视频并写好标题与正文 → 选择要发布的平台 → 按页面提示完成发布",
    href: "/tools/social-publish",
    gradient: "from-rose-500/20 via-orange-500/15 to-amber-500/10",
    tag: "运营",
    bento: "wide",
    demoHint: "写一次 · 多平台发 · 省时省力",
  },
  {
    id: "hot-trends",
    title: "热点中心",
    description: "看看抖音、小红书上正在火什么，按榜单浏览，方便你快速跟上话题。",
    usageGuide: "切换平台 → 浏览实时榜单 → 点开感兴趣的话题查看详情",
    href: "/tools/hot-trends",
    gradient: "from-red-500/20 to-orange-500/10",
    tag: "运营",
    bento: "wide",
    demoHint: "选平台 · 看榜单 · 跟热点",
  },
  {
    id: "media-search",
    title: "影视搜索",
    description: "搜索电影、剧集、综艺与动画，查看评分、简介与 TMDB 详情。",
    usageGuide: "输入片名 → 选择类型 → 搜索 → 查看详情或复制信息",
    href: "/tools/media-search",
    gradient: "from-blue-500/20 to-indigo-500/10",
    tag: "影视",
    bento: "wide",
    demoHint: "片名搜索 · 热门推荐 · TMDB",
  },
  {
    id: "media-download",
    title: "影视资源下载",
    description: "按片名从 2厅、3厅、3&4厅、5厅 找网盘资源，找到就能复制分享。",
    usageGuide: "输入片名 → 浏览搜索结果 → 展开条目并复制需要的链接",
    href: "/tools/media-download",
    gradient: "from-amber-500/20 to-orange-500/10",
    tag: "影视",
    bento: "default",
    demoHint: "输入片名 → 搜索 → 复制链接",
  },
  {
    id: "spider-builder",
    title: "小蜘蛛爬虫",
    description: "不会写代码也能从网页里整理出标题、链接等列表，导出成表格文件备用。",
    usageGuide: "选择抓取场景 → 填入目标网页地址 → 开始抓取 → 导出表格文件",
    href: "/tools/spider-builder",
    gradient: "from-slate-500/20 to-zinc-500/10",
    tag: "开发",
    bento: "default",
    demoHint: "选场景 → 填网址 → 导出表格",
  },
  {
    id: "doc-convert",
    title: "文档转换",
    description: "PDF 和 Word 互转、把 PDF 变成图片、多张图片合成一份 PDF，在浏览器里就能完成。",
    usageGuide: "选择转换类型 → 上传文件 → 等待处理 → 下载结果文件",
    href: "/tools/doc-convert",
    gradient: "from-teal-500/20 to-emerald-500/10",
    tag: "文档",
    bento: "default",
    demoHint: "选类型 → 上传 → 下载结果",
  },
  {
    id: "subtitle-workshop",
    title: "字幕工坊",
    description: "给视频或音频自动加字幕，也能从片子里提取原有字幕，改好后导出使用。",
    usageGuide: "选择转写、提取或编辑 → 上传文件 → 处理完成后下载或继续编辑",
    href: "/tools/subtitle-workshop",
    gradient: "from-cyan-500/20 to-teal-500/10",
    tag: "视频",
    bento: "default",
    demoHint: "加字幕 · 提取 · 编辑导出",
  },
  {
    id: "ai-video-edit",
    title: "AI 视频剪辑",
    description: "用大白话告诉 AI 怎么剪，或把口播稿配上画面并生成配音，出片更快。",
    usageGuide: "智能剪辑：上传视频并说明想要的效果；剪口播：上传素材和文稿，由 AI 匹配画面并配音",
    href: "/tools/ai-video-edit",
    gradient: "from-fuchsia-500/20 via-violet-500/15 to-cyan-500/10",
    tag: "视频",
    bento: "wide",
    demoHint: "说清需求 · 看方案 · 下载成片",
  },
  {
    id: "gif-maker",
    title: "GIF 动图",
    description: "从视频里截一段做成动图，开始时间、长短和大小都能自己调。",
    usageGuide: "上传视频 → 设置要截取的片段和效果 → 生成后下载动图",
    href: "/tools/gif-maker",
    gradient: "from-amber-500/20 to-orange-500/10",
    tag: "视频",
    bento: "default",
    demoHint: "上传视频 → 调片段 → 下载动图",
  },
  {
    id: "text-toolbox",
    title: "文本工具箱",
    description: "统计字数、去掉重复行、整理 JSON、预览 Markdown，粘贴就能用。",
    usageGuide: "选择需要的工具 → 粘贴或输入文字 → 查看处理结果",
    href: "/tools/text-toolbox",
    gradient: "from-slate-500/20 to-zinc-500/10",
    tag: "文档",
    bento: "default",
    demoHint: "选工具 · 粘贴文字 · 看结果",
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
