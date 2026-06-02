import { homepageFeaturedToolIds } from "@/lib/featured-tools";

export type BentoSize = "hero" | "wide" | "tall" | "default";

export type Tool = {
  id: string;
  title: string;
  /** 一句话官方介绍 */
  description: string;
  /** 功能使用说明（步骤或要点） */
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
    description: "解锁主流平台加密音乐，批量转换为 MP3、FLAC 等常用格式，支持打包下载。",
    usageGuide: "拖入或选择音乐文件 → 选择目标格式 → 开始转换 → 单首下载或打包 ZIP",
    href: "/tools/music-convert",
    gradient: "from-violet-500/20 to-fuchsia-500/10",
    tag: "音频",
    bento: "default",
    demoHint: "上传曲目 · 选格式 · 批量转换下载",
  },
  {
    id: "video-extract",
    title: "视频链接提取",
    description: "粘贴分享链接，一键解析主流平台视频，多清晰度在线下载。",
    usageGuide: "复制视频分享链接 → 粘贴并解析 → 选择清晰度 → 本页下载",
    href: "/tools/video-extract",
    gradient: "from-cyan-500/20 to-blue-500/10",
    tag: "视频",
    bento: "default",
    demoHint: "粘贴链接 → 解析 → 选择清晰度下载",
  },
  {
    id: "image-studio",
    title: "图像工坊",
    description: "图片压缩、清晰增强、智能抠图、人像美化、AI 修图与文生图",
    usageGuide: "选择功能（压缩/清晰/抠图/人像美化/修图/生图）→ 上传图片或输入描述 → 处理并下载",
    href: "/tools/image-studio",
    gradient: "from-sky-500/20 via-violet-500/15 to-emerald-500/10",
    tag: "图像",
    bento: "tall",
    demoHint: "选功能 · 上传或描述 · 下载成品",
  },
  {
    id: "ai-chat",
    title: "AI 对话",
    description: "智能对话助手：闲聊问答、图片理解，还能帮你打开站内工具并预填。",
    usageGuide: "直接输入想说的话；需要下载视频、搜片、写作等时，说明需求即可",
    href: "/tools/ai-chat",
    gradient: "from-purple-500/20 to-violet-500/10",
    tag: "AI",
    bento: "default",
    demoHint: "像朋友一样聊 · 也能帮你操作工具",
    homeFeatured: true,
  },
  {
    id: "memory",
    title: "记忆库",
    description: "保存你的偏好与重要信息，让 AI 对话更懂你、更连贯。",
    usageGuide: "登录并验证邮箱 → 添加记忆条目 → 对话时自动参考你的专属记忆",
    href: "/tools/memory",
    gradient: "from-emerald-500/20 to-teal-500/10",
    tag: "AI",
    bento: "default",
    demoHint: "添加偏好 · AI 越聊越懂你",
  },
  {
    id: "ai-search",
    title: "AI 全网搜索",
    description: "向 AI 提问，自动检索全网信息并给出带出处摘要，适合查资料与快速调研。",
    usageGuide: "输入问题 → 选择检索深度 → 查看 AI 摘要与引用来源",
    href: "/tools/ai-search",
    gradient: "from-indigo-500/20 via-violet-500/15 to-blue-500/10",
    tag: "AI",
    bento: "wide",
    demoHint: "提问 → 全网检索 → 摘要与来源",
  },
  {
    id: "app-builder",
    title: "一键做 App",
    description: "用自然语言描述需求，AI 生成可独立运行的单页应用，预览并下载。",
    usageGuide: "填写应用名称与类型 → 描述功能需求 → 生成 → 预览或下载 HTML",
    href: "/tools/app-builder",
    gradient: "from-cyan-500/20 via-teal-500/15 to-emerald-500/10",
    tag: "AI",
    bento: "default",
    demoHint: "描述需求 → 生成 → 预览下载",
  },
  {
    id: "ai-writer",
    title: "AI 写作助手",
    description: "多模式 AI 写作：文章、改写、润色、扩写、摘要、社媒文案、邮件与翻译。",
    usageGuide: "选择写作模式 → 输入素材或主题 → 一键生成 → 复制或下载",
    href: "/tools/ai-writer",
    gradient: "from-indigo-500/20 via-blue-500/15 to-violet-500/10",
    tag: "AI",
    bento: "default",
    demoHint: "选模式 · 输入素材 · 复制或下载",
  },
  {
    id: "ai-workflow",
    title: "AI 工作流",
    description: "预设多步创作流水线：内容成稿、社媒内容包、视频脚本，逐步或一键完成。",
    usageGuide: "选择工作流模板 → 填写主题或素材 → 逐步执行或一键跑完全流程",
    href: "/tools/ai-workflow",
    gradient: "from-purple-500/20 via-violet-500/15 to-fuchsia-500/10",
    tag: "AI",
    bento: "wide",
    demoHint: "选模板 · 填主题 · 串联执行",
  },
  {
    id: "hot-trends",
    title: "热点中心",
    description: "实时浏览抖音、小红书等平台热点榜单，快速捕捉流量话题。",
    usageGuide: "切换平台 → 浏览实时榜单 → 点击条目查看详情与热度",
    href: "/tools/hot-trends",
    gradient: "from-red-500/20 to-orange-500/10",
    tag: "运营",
    bento: "wide",
    demoHint: "选平台 · 看榜单 · 跟进话题",
  },
  {
    id: "media-search",
    title: "影视搜索",
    description: "输入片名，智能聚合影视信息与观看、搜索入口，一键复制资源链接包。",
    usageGuide: "输入片名或点热门推荐 → 搜索 → 查看详情 → 复制链接包",
    href: "/tools/media-search",
    gradient: "from-blue-500/20 to-indigo-500/10",
    tag: "影视",
    bento: "wide",
    demoHint: "输入片名 → 查看结果 → 复制链接包",
  },
  {
    id: "media-download",
    title: "影视资源下载",
    description: "按片名检索网盘资源链接，多平台聚合，一键复制分享。",
    usageGuide: "输入片名 → 搜索 → 展开结果 → 复制对应网盘链接",
    href: "/tools/media-download",
    gradient: "from-amber-500/20 to-orange-500/10",
    tag: "影视",
    bento: "default",
    demoHint: "输入片名 → 搜索 → 复制网盘链接",
  },
  {
    id: "spider-builder",
    title: "小蜘蛛爬虫",
    description: "可视化网页数据采集：选场景、填网址，导出 JSON 或 CSV。",
    usageGuide: "选择抓取场景 → 输入目标网址 → 开始抓取 → 导出数据文件",
    href: "/tools/spider-builder",
    gradient: "from-slate-500/20 to-zinc-500/10",
    tag: "开发",
    bento: "default",
    demoHint: "选场景 → 填网址 → 导出数据",
  },
  {
    id: "doc-convert",
    title: "文档转换",
    description: "PDF 与 Word 互转、PDF 导出图片、多张图片合并 PDF，安全高效。",
    usageGuide: "选择转换类型 → 上传文件 → 开始转换 → 下载结果",
    href: "/tools/doc-convert",
    gradient: "from-teal-500/20 to-emerald-500/10",
    tag: "文档",
    bento: "default",
    demoHint: "选类型 → 上传 → 下载结果",
  },
  {
    id: "subtitle-workshop",
    title: "字幕工坊",
    description: "本地/云端语音转字幕、提取内嵌字幕轨，支持 SRT 编辑与 VTT 导出。",
    usageGuide: "选择转写/提取/编辑 → 上传媒资文件 → 处理 → 下载或编辑字幕",
    href: "/tools/subtitle-workshop",
    gradient: "from-cyan-500/20 to-teal-500/10",
    tag: "视频",
    bento: "default",
    demoHint: "转写 · 提取 · 编辑导出",
  },
  {
    id: "ai-video-edit",
    title: "AI 视频剪辑",
    description: "用自然语言描述剪辑需求，AI 生成方案并由 ffmpeg 本地渲染导出。",
    usageGuide: "上传视频 → 描述剪辑（裁剪、画幅、变速、淡入淡出等）→ 预览方案 → 渲染下载",
    href: "/tools/ai-video-edit",
    gradient: "from-fuchsia-500/20 via-violet-500/15 to-cyan-500/10",
    tag: "视频",
    bento: "wide",
    demoHint: "描述需求 · 预览方案 · 下载成片",
  },
  {
    id: "gif-maker",
    title: "GIF 动图",
    description: "从视频截取片段生成 GIF，可调起始时间、时长、帧率与宽度。",
    usageGuide: "上传视频 → 设置片段起止与参数 → 生成 → 下载 GIF",
    href: "/tools/gif-maker",
    gradient: "from-amber-500/20 to-orange-500/10",
    tag: "视频",
    bento: "default",
    demoHint: "上传视频 → 调参数 → 下载 GIF",
  },
  {
    id: "text-toolbox",
    title: "文本工具箱",
    description: "字数统计、去重行、JSON 格式化、Markdown 预览，即开即用。",
    usageGuide: "选择工具标签 → 粘贴或输入文本 → 查看处理结果",
    href: "/tools/text-toolbox",
    gradient: "from-slate-500/20 to-zinc-500/10",
    tag: "文档",
    bento: "default",
    demoHint: "选工具 · 粘贴文本 · 查看结果",
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
