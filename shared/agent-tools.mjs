/** 智能体可操作的站点工具目录（服务端系统提示 + 客户端预填字段约定） */
export const AGENT_TOOLS = [
  {
    id: "video-extract",
    title: "视频链接提取",
    href: "/tools/video-extract",
    description: "粘贴视频分享链接，解析后在本页下载，多种清晰度可选",
    fields: { url: "视频页面链接" },
  },
  {
    id: "media-download",
    title: "影视资源下载",
    href: "/tools/media-download",
    description: "按名称搜索相关内容，找到即可复制链接",
    fields: { keyword: "片名或关键词" },
  },
  {
    id: "music-convert",
    title: "音乐工坊",
    href: "/tools/music-convert",
    description: "把各平台下载的歌曲转成 MP3、FLAC 等格式，支持多首一起转",
    fields: { format: "MP3|FLAC|WAV|AAC|OGG|M4A" },
  },
  {
    id: "image-studio",
    title: "图像工坊",
    href: "/tools/image-studio",
    description: "压缩、变清晰、抠图、换背景、去水印、AI消除、OCR提字、证件照、美化人像，还能用文字描述生成新图",
    fields: {
      mode: "compress|sharpen|cutout|bgreplace|watermark|beautify|edit|generate|erase|ocr|idphoto",
      prompt: "生图、修图或背景描述",
    },
  },
  {
    id: "image-fetch",
    title: "图片检索",
    href: "/tools/image-studio",
    description: "按主题搜索 logo、海报、配图；识图校验后仅返回画面一致的图片，支持多平台高清素材与压缩包",
    fields: {
      query: "主题+图类型，如「唱无界 高清配图」；指定平台可写 source=wechat,douyin,xiaohongshu,taobao,meituan",
    },
  },
  {
    id: "ai-search",
    title: "AI 全网搜索",
    href: "/tools/ai-search",
    description: "有问题直接问，系统会先理解意图再扩散检索全网，整理摘要并附来源链接",
    fields: { query: "用户原话问题（系统会自动改写检索词，勿自行压缩）" },
  },
  {
    id: "ppt-generate",
    title: "PPT 生成",
    href: "/tools/ai-writer",
    description: "根据主题生成标准 .pptx 演示文稿，可下载后用 PowerPoint/WPS/Keynote 打开",
    fields: { topic: "PPT 主题，如「唱无界 品牌宣传」" },
  },
  {
    id: "ai-writer",
    title: "AI 写作助手",
    href: "/tools/ai-writer",
    description: "写文章、改写法、润色、扩写、摘要、社媒文案、邮件、翻译、工作报告、简历优化、文档速读",
    fields: {
      mode: "article|rewrite|polish|expand|summarize|social|email|translate|work-report|resume|doc-speedread",
      input: "文本或主题",
    },
  },
  {
    id: "storyboard",
    title: "分镜生图",
    href: "/tools/storyboard",
    description: "输入视频主题或脚本，自动拆分分镜并为每个镜头生成配图",
    fields: {
      topic: "视频主题或脚本",
      sceneCount: "镜头数量 2-8",
      style: "cinematic|realistic|illustration|anime|minimal",
      aspectRatio: "9:16|16:9|1:1",
    },
  },
  {
    id: "hot-trends",
    title: "热点中心",
    href: "/tools/hot-trends",
    description: "查看抖音、小红书上正在火什么，按榜单浏览话题",
    fields: { platform: "douyin|xiaohongshu" },
  },
  {
    id: "social-publish",
    title: "社媒一键分发",
    href: "/tools/social-publish",
    description: "同一条视频或文案尽量发到多个平台，少重复粘贴",
    fields: {
      title: "标题",
      description: "正文文案",
      tags: "话题标签",
      platforms: "douyin,weixin-channels,xiaohongshu 等逗号分隔",
    },
  },
  {
    id: "web-video-extract",
    title: "网页视频提取",
    href: "/tools/web-video-extract",
    description: "粘贴网页链接，扫描页面中的视频地址并下载",
    fields: { url: "包含视频的网页地址" },
  },
  {
    id: "doc-convert",
    title: "文档转换",
    href: "/tools/doc-convert",
    description: "PDF 与 Word 互转、PDF 合并拆分压缩、PDF 变图片、多张图片合成 PDF",
    fields: { mode: "pdf-to-word|word-to-pdf|pdf-to-images|images-to-pdf|pdf-merge|pdf-split|pdf-compress" },
  },
  {
    id: "subtitle-workshop",
    title: "字幕工坊",
    href: "/tools/subtitle-workshop",
    description: "给视频或音频自动加字幕，也能从片子里提取原有字幕",
    fields: { tab: "transcribe|extract|edit" },
  },
  {
    id: "gif-maker",
    title: "GIF 动图",
    href: "/tools/gif-maker",
    description: "从视频里截一段做成动图，时间、长短和大小可调",
    fields: { start: "起始秒", duration: "时长秒", fps: "帧率", width: "宽度px" },
  },
  {
    id: "text-toolbox",
    title: "文本工具箱",
    href: "/tools/text-toolbox",
    description: "统计字数、去重复行、整理 JSON、预览 Markdown",
    fields: { tab: "stats|dedupe|json|markdown", input: "待处理文本" },
  },
  {
    id: "memory",
    title: "记忆库",
    href: "/tools/memory",
    description: "记下偏好和常用信息，之后聊天会更懂你、前后更连贯",
    fields: { content: "记忆内容" },
  },
];

/** @param {boolean} [isAdmin] */
export function getAgentTools(isAdmin = false) {
  return AGENT_TOOLS.filter((t) => !t.adminOnly || isAdmin);
}

