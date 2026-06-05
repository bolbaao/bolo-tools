export type Tool = {
  id: string;
  title: string;
  /** 面向用户的一句话介绍 */
  description: string;
  href: string;
  gradient: string;
  tag: string;
  /** 不出现在侧边栏工具列表，改在个人中心展示 */
  personalCenter?: boolean;
};

export const tools: Tool[] = [
  {
    id: "music-convert",
    title: "音乐工坊",
    description: "把各平台下载的歌曲转成 MP3、FLAC 等常用格式，支持多首一起转、打包下载。",
    href: "/tools/music-convert",
    gradient: "from-violet-500/20 to-fuchsia-500/10",
    tag: "音频",
  },
  {
    id: "video-extract",
    title: "视频链接提取",
    description: "复制分享链接粘贴进来，帮你解析并下载，多种清晰度可选。",
    href: "/tools/video-extract",
    gradient: "from-cyan-500/20 to-blue-500/10",
    tag: "视频",
  },
  {
    id: "image-studio",
    title: "图像工坊",
    description: "让图片更小、更清晰，一键抠图、换背景、去水印、美化人像，还能用文字描述生成新图。",
    href: "/tools/image-studio",
    gradient: "from-sky-500/20 via-violet-500/15 to-emerald-500/10",
    tag: "图像",
  },
  {
    id: "mlsharp-3d",
    title: "3D 工坊",
    description: "上传一张照片，快速生成可旋转查看的 3D 模型，下载后可在 Blender、SuperSplat 等软件中打开。",
    href: "/tools/mlsharp-3d",
    gradient: "from-violet-500/20 via-indigo-500/15 to-cyan-500/10",
    tag: "图像",
  },
  {
    id: "memory",
    title: "记忆库",
    description: "记下你的偏好和常用信息，方便在各工具里保持一致的个人设置。",
    href: "/tools/memory",
    gradient: "from-emerald-500/20 to-teal-500/10",
    tag: "AI",
    personalCenter: true,
  },
  {
    id: "ai-search",
    title: "AI 全网搜索",
    description: "有问题直接问，帮你搜遍全网并整理摘要，附带来源链接，查资料更省力。",
    href: "/tools/ai-search",
    gradient: "from-indigo-500/20 via-violet-500/15 to-blue-500/10",
    tag: "AI",
  },
  {
    id: "app-builder",
    title: "一键做 App",
    description: "说出你想做的小工具或页面，AI 生成后可继续优化、多端预览并下载，也能配合 iPhone 快捷指令使用。",
    href: "/tools/app-builder",
    gradient: "from-cyan-500/20 via-teal-500/15 to-emerald-500/10",
    tag: "AI",
  },
  {
    id: "ai-writer",
    title: "AI 写作助手",
    description: "写文章、改写法、润色、扩写、写摘要、社媒文案、邮件或翻译，选对模式就能开始。",
    href: "/tools/ai-writer",
    gradient: "from-indigo-500/20 via-blue-500/15 to-violet-500/10",
    tag: "AI",
  },
  {
    id: "ai-workflow",
    title: "AI 工作流",
    description: "选一条创作流程，从成稿、社媒文案到视频脚本，可以一步步做，也能一键跑完。",
    href: "/tools/ai-workflow",
    gradient: "from-purple-500/20 via-violet-500/15 to-fuchsia-500/10",
    tag: "AI",
  },
  {
    id: "social-publish",
    title: "社媒一键分发",
    description: "同一条视频或文案，尽量帮你发到抖音等多个平台，少重复粘贴、少来回切换。",
    href: "/tools/social-publish",
    gradient: "from-rose-500/20 via-orange-500/15 to-amber-500/10",
    tag: "运营",
  },
  {
    id: "hot-trends",
    title: "热点中心",
    description: "看看抖音、小红书上正在火什么，按榜单浏览，方便你快速跟上话题。",
    href: "/tools/hot-trends",
    gradient: "from-red-500/20 to-orange-500/10",
    tag: "运营",
  },
  {
    id: "media-download",
    title: "影视资源下载",
    description: "输入名称搜索相关内容，找到即可一键复制链接。",
    href: "/tools/media-download",
    gradient: "from-amber-500/20 to-orange-500/10",
    tag: "影视",
  },
  {
    id: "spider-builder",
    title: "小蜘蛛爬虫",
    description: "不会写代码也能从网页里整理出标题、链接等列表，导出成表格文件备用。",
    href: "/tools/spider-builder",
    gradient: "from-slate-500/20 to-zinc-500/10",
    tag: "开发",
  },
  {
    id: "doc-convert",
    title: "文档转换",
    description: "PDF 和 Word 互转、把 PDF 变成图片、多张图片合成一份 PDF，在浏览器里就能完成。",
    href: "/tools/doc-convert",
    gradient: "from-teal-500/20 to-emerald-500/10",
    tag: "文档",
  },
  {
    id: "subtitle-workshop",
    title: "字幕工坊",
    description: "给视频或音频自动加字幕，也能从片子里提取原有字幕，改好后导出使用。",
    href: "/tools/subtitle-workshop",
    gradient: "from-cyan-500/20 to-teal-500/10",
    tag: "视频",
  },
  {
    id: "gif-maker",
    title: "GIF 动图",
    description: "从视频里截一段做成动图，开始时间、长短和大小都能自己调。",
    href: "/tools/gif-maker",
    gradient: "from-amber-500/20 to-orange-500/10",
    tag: "视频",
  },
  {
    id: "text-toolbox",
    title: "文本工具箱",
    description: "统计字数、去掉重复行、整理 JSON、预览 Markdown，粘贴就能用。",
    href: "/tools/text-toolbox",
    gradient: "from-slate-500/20 to-zinc-500/10",
    tag: "文档",
  },
];

export function getToolById(id: string): Tool | undefined {
  return tools.find((t) => t.id === id);
}

export function getSidebarTools(): Tool[] {
  return tools.filter((t) => !t.personalCenter);
}

export function getPersonalCenterTools(): Tool[] {
  return tools.filter((t) => t.personalCenter);
}

/** 侧边栏分类展示顺序 */
export const CATEGORY_ORDER = ["AI", "图像", "视频", "音频", "文档", "运营", "影视", "开发"];
