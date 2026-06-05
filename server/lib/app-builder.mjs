import OpenAI from "openai";
import { HttpError } from "./http-error.mjs";
import { resolveChatConfig, getChatProviderLabel } from "./chat-config.mjs";
import { env } from "./env.mjs";

/** @type {Record<string, { label: string, hint: string }>} */
export const APP_TYPES = {
  tool: {
    label: "实用小工具",
    hint: "计算器、转换器、待办、计时器等单机可用工具",
  },
  shortcuts: {
    label: "快捷指令配套",
    hint: "生成可供 iPhone 快捷指令打开和调用的网页小工具",
  },
  landing: {
    label: "产品落地页",
    hint: "宣传页、产品介绍、下载引导",
  },
  dashboard: {
    label: "数据看板",
    hint: "图表、统计面板、管理后台风格",
  },
  api: {
    label: "接口模拟页",
    hint: "生成可供快捷指令测试的模拟接口页面",
  },
  form: {
    label: "表单问卷",
    hint: "收集、投票、报名、反馈",
  },
  game: {
    label: "轻量小游戏",
    hint: "互动页面、小游戏、测验",
  },
};

/** @type {Record<string, { label: string, hint: string, prompt: string }>} */
export const STYLE_THEMES = {
  auto: {
    label: "智能匹配",
    hint: "根据应用类型自动选择最合适的视觉风格",
    prompt: "",
  },
  dark: {
    label: "深色现代",
    hint: "深色背景、高对比、适合工具与看板",
    prompt: "深色现代风：#0f0f12 背景、柔和边框、青/紫点缀、圆角卡片、舒适行高",
  },
  light: {
    label: "清爽浅色",
    hint: "白底简洁，适合表单与落地页",
    prompt: "清爽浅色风：白/浅灰背景、清晰层次、蓝色主色、充足留白、易读字体",
  },
  minimal: {
    label: "极简黑白",
    hint: "少装饰、重内容，适合笔记与计算器",
    prompt: "极简黑白风：黑白灰为主、细线分隔、无渐变、大字号、克制动画",
  },
  colorful: {
    label: "活力渐变",
    hint: "渐变与插画感，适合游戏与宣传页",
    prompt: "活力渐变风：大胆渐变背景、圆润按钮、微动效、活泼配色、友好插画感",
  },
  glass: {
    label: "玻璃拟态",
    hint: "毛玻璃与半透明，适合仪表盘与展示页",
    prompt: "玻璃拟态风：backdrop-filter 模糊、半透明卡片、柔和阴影、精致边框光晕",
  },
};

const BASE_SYSTEM_RULES = `你是专业的前端工程师，根据用户需求生成完整可运行的单页 Web 应用。

硬性要求：
1. 输出且仅输出一个完整 HTML 文档，以 <!DOCTYPE html> 开头
2. 所有 CSS 写在 <style> 内，所有 JS 写在 <script> 内；不依赖 npm、构建工具或本地文件
3. 可使用公共 CDN（如 Google Fonts、Chart.js），但核心功能必须在单文件内可运行
4. 界面现代、美观、移动端友好；含 viewport meta、触控区域 ≥ 44px
5. 功能完整可用：交互有反馈，必要数据可用 localStorage；按钮有 hover/active 态
6. 不要使用 alert 作为主要 UI；用页面内 toast/提示条
7. 不要输出 markdown 代码块，不要输出解释文字
8. 安全：不要 eval、document.write（format=json 模式除外）、加载用户输入的外链脚本
9. 品牌：禁止在 title、h1、页脚、关于页写入「菠萝工具箱」或任何用户未明确要求的平台/产品名；用户未给应用名称时用简短功能名或「应用」，不要编造品牌
10. 质量：语义化 HTML、合理 heading 层级、表单 label 关联、空状态与加载态提示
11. 多步向导：翻页按钮用 type="button" + 纯 JS 切换步骤（勿依赖 form submit）；步骤状态优先用内存变量，localStorage 仅作可选持久化；确保「下一步」「上一步」在未填必填项时禁用，填好后可点击`;

/** @type {Record<string, string>} */
const TYPE_PROMPTS = {
  tool: `应用类型：实用小工具
- 核心功能一键可达，首屏即主操作区
- 输入校验、结果可复制，必要时支持历史记录（localStorage）
- 适合手机竖屏单手操作`,

  shortcuts: `应用类型：快捷指令 / 自动化配套 Web 页
重要：用户要的是「能被 iOS/macOS 快捷指令 App 调用」的网页，不是普通展示页，也不是 .shortcut 文件。

必须全部实现：
1. **URL 参数 API（核心）**
   - 页面加载时解析 location.search，支持 action / q / text / input 等参数
   - 至少 3 种 action，例如：transform、encode、fetch-mock、format、ping
   - 当 URL 带 ?format=json 时，仅输出 JSON（document.body 替换为纯 JSON 文本，便于快捷指令「获取 URL 内容」解析）
   - 当 URL 带 ?format=text 时，仅输出纯文本结果
2. **快捷指令安装向导**
   - 页面内固定区域，分步说明：① 部署/打开本页 URL ② 快捷指令添加「获取 URL 内容」③ 传入文本/剪贴板变量
   - 「下一步」「上一步」用 type="button" + JS 切换，确保预览内可点击
   - 为每个 action 生成完整示例 URL，带「复制链接」按钮
3. **人机双模式**
   - 无 URL 参数时：正常 UI 表单操作
   - 有 URL 参数时：自动执行并展示/输出结果（可折叠 UI，结果优先）
4. **剪贴板**：所有 URL、JSON、结果提供「复制」按钮（navigator.clipboard）

可选增强：Web Share API、x-success URL 回调说明、POST body 说明（快捷指令可用「获取 URL 内容」+ POST）

禁止：只做普通表单而与快捷指令/URL 调用无关；禁止声称能导出 .shortcut 文件`,

  landing: `应用类型：产品落地页 / 宣传页
- Hero、特性、CTA、FAQ 结构完整
- 平滑滚动、响应式布局
- 可含定价/下载按钮（链接占位 #）`,

  dashboard: `应用类型：数据看板 / 管理面板
- 侧边栏或顶栏导航，至少 2 个视图
- 用 mock 数据渲染图表（CSS/SVG/Canvas 均可）或 KPI 卡片
- 表格支持排序或筛选（前端 mock）`,

  api: `应用类型：API / Webhook 模拟器
- 通过 URL 路径参数或 query 模拟 REST：?method=GET&path=/users&id=1
- 返回 JSON，支持 ?format=json 纯 JSON 模式
- 提供 API 文档区：列出所有端点、参数、示例 curl/快捷指令 URL
- 可模拟延迟、错误码（?status=404）`,

  form: `应用类型：表单 / 问卷 / 收集页
- 多字段校验、进度或分步；分步时顶部显示步骤条，底部固定「上一步」「下一步」
- 翻页按钮必须 type="button"，点击后用 JS 切换步骤面板（display/visibility），不要整页刷新
- 当前步骤校验通过后才允许点「下一步」；最后一步为「提交」
- 提交后在页内展示摘要（mock 提交，localStorage 可选存草稿）`,

  game: `应用类型：轻量小游戏 / 互动页
- 完整游戏循环：开始、进行、计分、重开
- 触控/键盘均可，有胜负或完成反馈`,
};

/** @type {{ id: string, appType: string, appName: string, title: string, userSummary: string, description: string }[]} */
export const APP_PRESETS = [
  {
    id: "shortcuts-text-toolkit",
    appType: "shortcuts",
    appName: "文本工具箱·快捷指令版",
    title: "快捷指令 · 文本工具",
    userSummary: "在 iPhone 快捷指令里用的文本编解码、统计等小工具页",
    description: `做一个供 iOS 快捷指令调用的文本工具 Web 页。

功能（UI + URL API 双模式）：
1. action=base64_encode / base64_decode：对 text 参数编解码
2. action=url_encode / url_decode
3. action=md5：对 text 做 MD5（纯 JS 实现）
4. action=lines：统计 text 的行数、字数
5. 无参数时：表单输入 + 按钮操作 + 结果复制

URL 示例：?action=base64_encode&text=hello&format=json 返回 {"ok":true,"result":"..."}
必须含快捷指令配置向导（3 步）和每个 action 的复制链接按钮。
深色主题，移动端友好。`,
  },
  {
    id: "shortcuts-clipboard-bridge",
    appType: "shortcuts",
    appName: "剪贴板桥接页",
    title: "快捷指令 · 剪贴板桥接",
    userSummary: "帮快捷指令暂存、读取剪贴板内容的桥接页面",
    description: `快捷指令配套页：在「获取 URL 内容」与手动操作间桥接。

功能：
- action=store&text=xxx：把 text 存入 localStorage 队列（最多 20 条），返回 JSON
- action=latest&format=json：返回最近一条
- action=list&format=json：返回全部列表
- action=clear：清空
- 无参数时：展示队列 UI，可手动粘贴添加、删除、复制

每步都有快捷指令示例 URL 和安装说明。`,
  },
  {
    id: "shortcuts-webhook-mock",
    appType: "api",
    appName: "Webhook 模拟器",
    title: "接口 · 模拟测试",
    userSummary: "模拟常见接口返回，方便在快捷指令里调试流程",
    description: `模拟 Webhook/API 供快捷指令测试。

端点（query 模拟）：
- ?endpoint=ping → {"ok":true,"ts":时间戳}
- ?endpoint=echo&msg=xxx → 回显
- ?endpoint=random&min=1&max=100 → 随机数
- ?endpoint=weather&city=北京 → mock 天气 JSON
- ?format=json 时 body 仅 JSON

含 API 文档表格、curl 示例、快捷指令「获取 URL 内容」示例链接。`,
  },
  {
    id: "tool-pomodoro-todo",
    appType: "tool",
    appName: "番茄待办",
    title: "番茄钟 + 待办",
    userSummary: "25 分钟专注计时，搭配待办清单，记录今天完成了几次",
    description: `番茄钟 + 待办清单合一，深色主题。
- 25/5 分钟番茄计时，可暂停重置
- 待办增删改、完成勾选，localStorage 持久化
- 统计今日完成番茄数
- 首屏大计时器，底部待办列表`,
  },
  {
    id: "tool-unit-converter",
    appType: "tool",
    appName: "全能单位换算",
    title: "单位换算器",
    userSummary: "长度、重量、温度等常用单位双向换算，结果可复制",
    description: `单位换算器：长度、重量、温度、面积、数据存储（B/KB/MB/GB）。
Tab 切换类别，双向实时换算，复制结果，最近换算历史。`,
  },
  {
    id: "landing-saas",
    appType: "landing",
    appName: "SaaS 产品页",
    title: "产品落地页",
    userSummary: "带介绍、亮点、价格和常见问题的产品宣传页",
    description: `科技感 SaaS 产品发布页：Hero 标题+副标题+CTA、3 个特性卡片、定价三档、FAQ 4 条、页脚。
渐变深色背景，scroll 动画，移动端响应式。`,
  },
  {
    id: "dashboard-analytics",
    appType: "dashboard",
    appName: "运营看板",
    title: "数据看板",
    userSummary: "展示关键指标、趋势图和渠道表格的运营数据页（示例数据）",
    description: `小型运营数据看板（mock 数据）：
- KPI 四宫格：用户、收入、转化、留存
- 7 日折线图（Canvas/SVG）
- 渠道表格可排序
- 侧边栏切换「概览 / 渠道 / 设置」`,
  },
  {
    id: "form-event-register",
    appType: "form",
    appName: "活动报名",
    title: "活动报名表",
    userSummary: "收集姓名、联系方式和场次选择的活动报名页",
    description: `线下活动报名表：姓名、手机、邮箱、场次选择、 dietary 备注。
前端校验、提交后展示确认页与报名号（随机生成），可「再报一人」。`,
  },
  {
    id: "tool-expense-tracker",
    appType: "tool",
    appName: "记账本",
    title: "简易记账",
    userSummary: "记录收支、分类统计、本月汇总，数据本地保存",
    description: `个人记账小工具：
- 快速记一笔：金额、分类（餐饮/交通/购物等）、备注、收入/支出
- 本月汇总卡片：总收入、总支出、结余
- 分类饼图或条形图（纯 CSS/SVG/Canvas）
- 记录列表可删改，localStorage 持久化
- 首屏大按钮「记一笔」，移动端友好`,
  },
  {
    id: "tool-password-generator",
    appType: "tool",
    appName: "密码生成器",
    title: "密码生成器",
    userSummary: "自定义长度与字符集，一键生成强密码并复制",
    description: `密码生成器：
- 滑块调长度 8-64，勾选大写/小写/数字/符号
- 一键生成、强度指示条、复制按钮
- 批量生成 5 条列表
- 排除易混淆字符选项（0/O、1/l）`,
  },
  {
    id: "tool-habit-tracker",
    appType: "tool",
    appName: "习惯打卡",
    title: "习惯打卡",
    userSummary: "每日习惯打卡、连续天数统计、周视图日历",
    description: `习惯打卡应用：
- 添加习惯（名称、图标 emoji、每日目标次数）
- 今日打卡格子，点击切换完成态
- 连续打卡天数 streak、本周 7 日热力格
- localStorage 存习惯与打卡记录`,
  },
  {
    id: "landing-portfolio",
    appType: "landing",
    appName: "个人作品集",
    title: "个人作品集",
    userSummary: "展示项目、技能与联系方式的个人主页",
    description: `设计师/开发者个人作品集页：
- Hero：姓名、一句话介绍、社交链接图标
- 项目网格 6 个卡片（图占位 + 标题 + 标签 + 链接）
- 技能条或标签云
- 联系区：邮箱 + 表单（mock 提交）
- 平滑滚动导航、响应式、深色科技感`,
  },
  {
    id: "game-quiz",
    appType: "game",
    appName: "趣味测验",
    title: "趣味测验",
    userSummary: "多选题测验，答完出结果与分享文案",
    description: `轻量趣味测验（如「你是哪种创作者」）：
- 5 道题，每题 3-4 选项，进度条
- 根据选项计分，结尾展示结果类型 + 描述
- 可重开、结果可复制分享
- 卡通配色、过渡动画`,
  },
];

export const DEPLOY_NOTES = [
  {
    id: "local",
    title: "本地打开",
    steps: ["下载 HTML 文件", "双击或用浏览器打开即可使用，无需服务器"],
  },
  {
    id: "github-pages",
    title: "GitHub Pages",
    steps: [
      "新建仓库，上传 index.html（可将下载文件重命名）",
      "仓库 Settings → Pages → Source 选 main 分支",
      "几分钟后可通过 https://用户名.github.io/仓库名 访问",
    ],
  },
  {
    id: "netlify",
    title: "Netlify 拖拽部署",
    steps: [
      "打开 netlify.com 注册/登录",
      "将 HTML 文件拖入 Deploy 区域（或重命名为 index.html 后拖入文件夹）",
      "获得 *.netlify.app 公网链接，可绑定自定义域名",
    ],
  },
  {
    id: "shortcuts",
    title: "快捷指令调用",
    steps: [
      "将页面部署到公网可访问的 HTTPS URL",
      "快捷指令添加「获取 URL 内容」，填入带 action 等参数的链接",
      "可用 ?format=json 获取纯 JSON 结果供后续步骤解析",
    ],
  },
];

function stripMarkdownFences(raw) {
  const text = String(raw || "").trim();
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (match?.[1]) return match[1].trim();
  const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1?.[1]) return h1[1].trim().slice(0, 40);
  return "";
}

function buildSystemPrompt(appType) {
  const typeKey = APP_TYPES[appType] ? appType : "tool";
  const typeBlock = TYPE_PROMPTS[typeKey] || TYPE_PROMPTS.tool;
  return `${BASE_SYSTEM_RULES}\n\n${typeBlock}`;
}

function buildStyleBlock(styleTheme) {
  const key = styleTheme?.trim() || "auto";
  const theme = STYLE_THEMES[key];
  if (!theme?.prompt) return "";
  return `视觉风格要求：${theme.prompt}`;
}

function buildUserPrompt(opts) {
  const parts = [];
  if (opts.appName) {
    parts.push(`应用名称：${opts.appName}`);
  } else {
    parts.push("应用名称：未指定（界面与 <title> 勿使用任何平台品牌名，用功能简称即可）");
  }
  if (opts.presetId) {
    const preset = APP_PRESETS.find((p) => p.id === opts.presetId);
    if (preset) parts.push(`选用内置模板：${preset.title}（${preset.id}）`);
  }
  const styleBlock = buildStyleBlock(opts.styleTheme);
  if (styleBlock) parts.push(styleBlock);
  parts.push(`需求描述：\n${opts.description.slice(0, 4000)}`);
  if (opts.appType === "shortcuts" || opts.appType === "api") {
    parts.push(
      "",
      "再次强调：必须实现 URL 参数驱动 + format=json 纯 JSON 输出 + 快捷指令配置向导 + 复制按钮。",
    );
  }
  return parts.join("\n\n");
}

const REFINE_SYSTEM_RULES = `你是专业的前端工程师，根据用户的修改指令迭代优化已有单页 Web 应用。

硬性要求：
1. 在现有 HTML 基础上修改，保留仍适用的结构与功能，只改用户要求的部分
2. 输出且仅输出完整 HTML 文档，以 <!DOCTYPE html> 开头
3. 所有 CSS 在 <style> 内，所有 JS 在 <script> 内；不引入 npm 或构建工具
4. 不要输出 markdown 代码块或解释文字
5. 安全：不要 eval、不要加载用户输入的外链脚本
6. 若用户要求改配色/布局/文案/增删功能，确保改后仍可运行且移动端友好`;

function createChatClient(chatConfig) {
  const timeoutMs = Number(env("APP_BUILDER_TIMEOUT_MS", "180000")) || 180000;
  return new OpenAI({
    apiKey: chatConfig.apiKey,
    baseURL: chatConfig.baseURL,
    timeout: timeoutMs,
    maxRetries: 0,
  });
}

function parseHtmlResponse(raw, fallbackMessage = "AI 返回的内容不是有效 HTML，请调整后重试") {
  if (!raw) throw new HttpError(502, "AI 未返回有效内容");
  const html = stripMarkdownFences(raw);
  if (!/<!DOCTYPE\s+html/i.test(html) && !/<html[\s>]/i.test(html)) {
    throw new HttpError(502, fallbackMessage);
  }
  return html;
}

function handleChatError(e, chatConfig, timeoutHint = "生成超时，请简化描述后重试") {
  if (e instanceof HttpError) throw e;
  const msg = e?.message || String(e);
  if (/401|invalid.*key/i.test(msg)) {
    throw new HttpError(503, `${getChatProviderLabel(chatConfig.provider)} API Key 无效`);
  }
  if (/timeout|timed out|AbortError/i.test(msg)) {
    throw new HttpError(408, timeoutHint);
  }
  throw new HttpError(502, `应用生成失败：${msg.slice(0, 200)}`);
}

function resolveChatOrThrow() {
  const chatConfig = resolveChatConfig();
  if (!chatConfig) {
    throw new HttpError(
      503,
      "未配置 DEEPSEEK_API_KEY 或 ARK_API_KEY，无法生成应用。请在 .env 配置后重启。",
    );
  }
  return chatConfig;
}

/**
 * @param {{ description: string, appType?: string, appName?: string, presetId?: string, styleTheme?: string }} opts
 */
export async function generateAppHtml(opts) {
  const chatConfig = resolveChatOrThrow();

  const description = opts.description?.trim();
  if (!description) throw new HttpError(400, "请描述你想做的应用");

  const appType = opts.appType?.trim() || "tool";
  const appName = opts.appName?.trim();
  const client = createChatClient(chatConfig);

  try {
    const completion = await client.chat.completions.create({
      model: chatConfig.model,
      messages: [
        { role: "system", content: buildSystemPrompt(appType) },
        {
          role: "user",
          content: buildUserPrompt({
            description,
            appType,
            appName,
            presetId: opts.presetId,
            styleTheme: opts.styleTheme,
          }),
        },
      ],
      temperature: appType === "shortcuts" || appType === "api" ? 0.45 : 0.55,
      max_tokens: 8192,
    });

    const html = parseHtmlResponse(completion.choices?.[0]?.message?.content?.trim());

    return {
      html,
      title: extractTitle(html),
      provider: getChatProviderLabel(chatConfig.provider),
    };
  } catch (e) {
    handleChatError(e, chatConfig);
  }
}

/**
 * @param {{ html: string, instruction: string, appType?: string, appName?: string }} opts
 */
export async function refineAppHtml(opts) {
  const chatConfig = resolveChatOrThrow();

  const html = opts.html?.trim();
  if (!html) throw new HttpError(400, "缺少待优化的 HTML");

  const instruction = opts.instruction?.trim();
  if (!instruction) throw new HttpError(400, "请描述要如何修改");

  const appType = opts.appType?.trim() || "tool";
  const client = createChatClient(chatConfig);

  const truncatedHtml =
    html.length > 60000 ? `${html.slice(0, 60000)}\n<!-- ...truncated... -->` : html;

  try {
    const completion = await client.chat.completions.create({
      model: chatConfig.model,
      messages: [
        { role: "system", content: `${REFINE_SYSTEM_RULES}\n\n${TYPE_PROMPTS[appType] || TYPE_PROMPTS.tool}` },
        {
          role: "user",
          content: [
            opts.appName ? `应用名称：${opts.appName}` : "",
            "当前 HTML：",
            truncatedHtml,
            "",
            `修改指令：\n${instruction.slice(0, 2000)}`,
            "",
            "请输出修改后的完整 HTML。",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      temperature: 0.4,
      max_tokens: 8192,
    });

    const refined = parseHtmlResponse(
      completion.choices?.[0]?.message?.content?.trim(),
      "AI 返回的优化结果不是有效 HTML，请换种描述后重试",
    );

    return {
      html: refined,
      title: extractTitle(refined),
      provider: getChatProviderLabel(chatConfig.provider),
    };
  } catch (e) {
    handleChatError(e, chatConfig, "优化超时，请缩小修改范围后重试");
  }
}

export function listAppTypes() {
  return Object.entries(APP_TYPES).map(([id, { label, hint }]) => ({ id, label, hint }));
}

export function listAppPresets() {
  return APP_PRESETS.map(({ id, appType, appName, title, userSummary, description }) => ({
    id,
    appType,
    appName,
    title,
    description,
    descriptionPreview: userSummary,
  }));
}

export function getAppPreset(id) {
  return APP_PRESETS.find((p) => p.id === id) || null;
}

export function listStyleThemes() {
  return Object.entries(STYLE_THEMES).map(([id, { label, hint }]) => ({ id, label, hint }));
}

export function listDeployNotes() {
  return DEPLOY_NOTES;
}
