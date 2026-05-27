/** 智能体可操作的站点能力目录（注入系统提示） */
export const AGENT_TOOLS = [
  {
    id: "video-extract",
    title: "视频链接提取",
    href: "/tools/video-extract",
    description: "解析抖音、B站、YouTube 等链接并下载",
    fields: { url: "视频页面链接" },
  },
  {
    id: "media-search",
    title: "影视搜索",
    href: "/tools/media-search",
    description: "按片名搜索影视资源链接包",
    fields: { keyword: "片名或关键词" },
  },
  {
    id: "music-convert",
    title: "音乐转格式",
    href: "/tools/music-convert",
    description: "NCM 解锁与音频格式转换",
    fields: {},
  },
  {
    id: "image-compress",
    title: "压缩图片",
    href: "/tools/image-compress",
    description: "批量压缩 JPG/PNG/WebP",
    fields: {},
  },
  {
    id: "image-sharpen",
    title: "图片变清晰",
    href: "/tools/image-sharpen",
    description: "模糊图片锐化增强",
    fields: {},
  },
  {
    id: "smart-cutout",
    title: "智能抠图",
    href: "/tools/smart-cutout",
    description: "AI 去背景导出透明 PNG",
    fields: {},
  },
  {
    id: "hot-trends",
    title: "热点中心",
    href: "/tools/hot-trends",
    description: "抖音、小红书实时热点",
    fields: {},
  },
  {
    id: "spider-builder",
    title: "小蜘蛛爬虫",
    href: "/tools/spider-builder",
    description: "可视化网页数据抓取",
    fields: { url: "要抓取的网页地址" },
  },
  {
    id: "ai-video",
    title: "AI 生视频",
    href: "/tools/ai-video",
    description: "文字描述生成短视频",
    fields: { prompt: "视频创意描述" },
  },
];

export const AGENT_CATEGORIES = ["全部", "AI", "图像", "视频", "音频", "运营", "影视", "开发"];

export function buildAgentSystemPrompt(pageContext) {
  const toolLines = AGENT_TOOLS.map(
    (t) =>
      `- ${t.id}: ${t.title} (${t.href}) — ${t.description}${
        Object.keys(t.fields).length
          ? `；可预填: ${Object.entries(t.fields)
              .map(([k, v]) => `${k}=${v}`)
              .join(", ")}`
          : ""
      }`,
  ).join("\n");

  const ctx = pageContext
    ? `用户当前页面: ${pageContext.path || "/"}${pageContext.toolId ? `，工具: ${pageContext.toolId}` : ""}`
    : "用户可能在首页或任意工具页";

  return `你是「菠萝工具箱」的 AI 对话伙伴，陪用户轻松聊天；同时具备次要能力：在用户明确要求时，帮其打开本站工具并预填表单。

${ctx}

## 优先级（非常重要）
1. **主要：AI 对话** — 闲聊、吐槽、问答、情绪陪伴。此时 intent 必须为 "chat"，plan 为空数组，actions 为空数组。reply 专注自然口语，像朋友聊天，不要列清单、不要讲工具。
2. **次要：智能助手** — 仅当用户明确要用本站功能时才启用，例如：给视频链接要提取、要搜电影、要打开某工具、要看某类工具。此时 intent 为 "operate"，可给出 plan 与 actions。

## 可用工具（仅 operate 时使用）
${toolLines}

## 可用动作 type（仅 operate 时使用）
- navigate: 跳转页面，params: { "path": "/tools/xxx" }
- scroll: 页面内滚动，params: { "target": "tools"|"chat"|"top" }（仅首页有效）
- filter_tools: 首页筛选工具分类，params: { "category": "视频" }
- prefill: 预填工具表单，params: { "toolId": "video-extract", "fields": { "url": "https://..." } }

规则：
- 默认按闲聊处理，不要过度主动推销工具
- 用户仅打招呼、闲聊、问无关问题 → chat，无 actions
- 用户给出链接且要下载/提取视频 → operate + navigate + prefill
- 用户搜电影/要打开工具 → operate
- 不要编造站内不存在的功能

## 输出格式（仅输出 JSON，无 markdown）
{
  "intent": "chat" | "operate",
  "reply": "给用户看的简短中文",
  "plan": [],
  "actions": []
}`;
}
