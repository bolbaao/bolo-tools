import {
  buildPermissionsCatalogPrompt,
  listMissingPermissionTypes,
} from "./agent-permissions-catalog.mjs";

/** 智能体可操作的站点能力目录（注入系统提示） */
export const AGENT_TOOLS = [
  {
    id: "video-extract",
    title: "视频链接提取",
    href: "/tools/video-extract",
    description: "解析抖音、B站、YouTube、微信视频号等链接并下载",
    fields: { url: "视频页面链接" },
  },
  {
    id: "media-search",
    title: "影视搜索",
    href: "/tools/media-search",
    description: "输入片名，聚合影视信息与可复制的资源链接包",
    fields: { keyword: "片名或关键词" },
  },
  {
    id: "media-download",
    title: "影视资源下载",
    href: "/tools/media-download",
    description: "按片名检索网盘资源链接，多平台一键复制",
    fields: { keyword: "片名或关键词" },
  },
  {
    id: "music-convert",
    title: "音乐转格式",
    href: "/tools/music-convert",
    description: "解锁主流平台加密音乐，批量转换为 MP3、FLAC 等格式",
    fields: {},
  },
  {
    id: "image-studio",
    title: "图像工坊",
    href: "/tools/image-studio",
    description: "图片压缩、清晰增强、智能抠图、人像美化、AI 修图与文生图",
    fields: { mode: "compress|sharpen|cutout|beautify|edit|generate", prompt: "生图或修图描述" },
  },
  {
    id: "ai-search",
    title: "AI 全网搜索",
    href: "/tools/ai-search",
    description: "全网检索并由 AI 生成带引用的答案",
    fields: { query: "搜索问题或关键词" },
  },
  {
    id: "app-builder",
    title: "一键做 App",
    href: "/tools/app-builder",
    description: "用自然语言生成可运行的单页 Web 应用",
    fields: { description: "应用需求描述", appType: "tool|landing|dashboard|game|form", appName: "应用名称" },
  },
  {
    id: "ai-writer",
    title: "AI 写作助手",
    href: "/tools/ai-writer",
    description: "多模式写作：文章、改写、润色、摘要、社媒文案等",
    fields: { mode: "article|rewrite|polish|expand|summarize|social|email|translate", input: "文本或主题" },
  },
  {
    id: "ai-workflow",
    title: "AI 工作流",
    href: "/tools/ai-workflow",
    description: "多步 AI 流水线：内容创作、社媒包、视频脚本",
    fields: { workflowId: "content-pipeline|social-pack|script-pipeline", input: "主题或素材" },
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
    id: "doc-convert",
    title: "文档转换",
    href: "/tools/doc-convert",
    description: "PDF/Word 互转、PDF 转图片、图片转 PDF",
    fields: { mode: "pdf-to-word|word-to-pdf|pdf-to-images|images-to-pdf" },
  },
  {
    id: "subtitle-workshop",
    title: "字幕工坊",
    href: "/tools/subtitle-workshop",
    description: "语音转字幕、提取内嵌字幕",
    fields: {},
  },
  {
    id: "gif-maker",
    title: "GIF 动图",
    href: "/tools/gif-maker",
    description: "视频片段转 GIF",
    fields: {},
  },
  {
    id: "ai-video-edit",
    title: "AI 视频剪辑",
    href: "/tools/ai-video-edit",
    description: "自然语言描述剪辑需求，AI 生成方案并 ffmpeg 渲染",
    fields: { instruction: "剪辑描述，如去掉前5秒、裁成9:16竖屏" },
  },
  {
    id: "text-toolbox",
    title: "文本工具箱",
    href: "/tools/text-toolbox",
    description: "字数统计、JSON、Markdown",
    fields: {},
  },
];

export const AGENT_CATEGORIES = ["全部", "AI", "图像", "视频", "音频", "文档", "运营", "影视", "开发"];

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

  let ctx = pageContext
    ? `用户当前页面: ${pageContext.path || "/"}${pageContext.toolId ? `，工具: ${pageContext.toolId}` : ""}`
    : "用户可能在首页或任意工具页";

  if (pageContext?.clientInfo && typeof pageContext.clientInfo === "object") {
    ctx += `\n用户设备环境（无需授权，可直接使用）：${JSON.stringify(pageContext.clientInfo)}`;
  }

  if (pageContext?.clientPermissions && typeof pageContext.clientPermissions === "object") {
    ctx += `\n用户已授权的浏览器能力（JSON，请据此回答，勿编造未提供的数据）：${JSON.stringify(pageContext.clientPermissions)}`;
    const stillAvailable = listMissingPermissionTypes(pageContext.clientPermissions);
    if (stillAvailable.length) {
      ctx += `\n仍可自主申请的权限 type：${stillAvailable.join("、")}`;
    }
  } else {
    ctx += `\n用户尚未授权任何浏览器能力；你可自主申请清单中的任意项或多项。`;
  }

  if (pageContext?.weatherSnapshot && typeof pageContext.weatherSnapshot === "string") {
    ctx += pageContext.weatherSnapshot;
  }

  if (pageContext?.photoSnapshot && typeof pageContext.photoSnapshot === "string") {
    ctx += pageContext.photoSnapshot;
  }

  if (pageContext?.chatImagesSnapshot && typeof pageContext.chatImagesSnapshot === "string") {
    ctx += pageContext.chatImagesSnapshot;
  }

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

## 信息核实原则（非常重要）
你要区分两类问题：
1. **可核实事实** — 天气、气温、用户「这边/当地」位置、剪贴板里的链接、是否已允许通知、用户上传的图片内容等。回答前必须在上下文中找到依据（【实时天气】、【对话图片识别】、clientPermissions、clientInfo、用户原话）。
2. **主观交流** — 闲聊、情绪、泛泛感受、创意想象。无需核实，也**不要**申请权限。

当用户问的是**可核实事实**，而你**无法从上下文证明**答案时：
- **禁止**编造数据、禁止用「我猜」「应该」「打开 App 自己看」敷衍
- **你有权自主申请权限**：无需先问用户「可不可以申请」；直接在 permissionRequests 中列出所需项，由界面展示授权按钮
- 若同时缺多项依据，可**一次性申请所有仍缺失的权限**（见下方完整清单，每项一条，reason 必填）
- reply 简短说明为何需要这些授权；permissionRequests 与 actions 可同时存在；申请时 intent 仍为 "chat"

### 可申请的权限（完整清单，type 必须从中选取）
${buildPermissionsCatalogPrompt()}

**相册说明**：Web 不能静默扫相册；photos-picker 会打开系统选择器，请用户点选照片。问「第一张」时 reason 里说明请选中那张。

已有依据时：
- 【实时天气（Open-Meteo）】→ 必须给出具体气温、现象、风力，禁止再说无法查天气
- 【用户相册照片】含图像识别 → 据实描述，禁止说「看不到相册」
- 【对话图片识别】→ 用户已在对话框上传/粘贴图片；必须根据识别结果回答，勿让用户再传一遍
- clientPermissions 中 status=granted → 直接使用，勿重复申请
- status=denied 或 unsupported → 请用户**用文字**补充（如直接说城市名），勿再次弹同一权限

## 实时天气（系统自动注入）
- 用户消息含城市名时，系统可能注入【实时天气】块；有则必须据实回答
- 仅「当地/这边」且无天气块、无定位授权 → 申请 geolocation

## 输出格式（仅输出 JSON，无 markdown）
{
  "intent": "chat" | "operate",
  "reply": "给用户看的简短中文",
  "plan": [],
  "actions": [],
  "permissionRequests": []
}`;
}
