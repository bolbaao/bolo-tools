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
    hint: "可被 iOS/macOS 快捷指令通过 URL 调用的 Web 页（非 .shortcut 文件）",
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
    label: "API / Webhook 模拟",
    hint: "供快捷指令或脚本 GET/POST 调用的参数化接口页",
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

const BASE_SYSTEM_RULES = `你是专业的前端工程师，根据用户需求生成完整可运行的单页 Web 应用。

硬性要求：
1. 输出且仅输出一个完整 HTML 文档，以 <!DOCTYPE html> 开头
2. 所有 CSS 写在 <style> 内，所有 JS 写在 <script> 内；不依赖 npm、构建工具或本地文件
3. 可使用公共 CDN（如 Google Fonts），但核心功能必须在单文件内可运行
4. 界面现代、美观、移动端友好；深色或浅色主题与内容匹配
5. 功能完整可用：交互有反馈，必要数据可用 localStorage
6. 不要使用 alert 作为主要 UI；用页面内 toast/提示条
7. 不要输出 markdown 代码块，不要输出解释文字
8. 安全：不要 eval、document.write（format=json 模式除外）、加载用户输入的外链脚本
9. 品牌：禁止在 title、h1、页脚、关于页写入「菠萝工具箱」或任何用户未明确要求的平台/产品名；用户未给应用名称时用简短功能名或「应用」，不要编造品牌`;

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
- 多字段校验、进度或分步
- 提交后在页内展示摘要（mock 提交，localStorage 可选存草稿）`,

  game: `应用类型：轻量小游戏 / 互动页
- 完整游戏循环：开始、进行、计分、重开
- 触控/键盘均可，有胜负或完成反馈`,
};

/** @type {{ id: string, appType: string, appName: string, title: string, description: string }[]} */
export const APP_PRESETS = [
  {
    id: "shortcuts-text-toolkit",
    appType: "shortcuts",
    appName: "文本工具箱·快捷指令版",
    title: "快捷指令 · 文本工具",
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
    title: "API · Webhook 模拟",
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
    description: `单位换算器：长度、重量、温度、面积、数据存储（B/KB/MB/GB）。
Tab 切换类别，双向实时换算，复制结果，最近换算历史。`,
  },
  {
    id: "landing-saas",
    appType: "landing",
    appName: "SaaS 产品页",
    title: "SaaS 落地页",
    description: `科技感 SaaS 产品发布页：Hero 标题+副标题+CTA、3 个特性卡片、定价三档、FAQ 4 条、页脚。
渐变深色背景，scroll 动画，移动端响应式。`,
  },
  {
    id: "dashboard-analytics",
    appType: "dashboard",
    appName: "运营看板",
    title: "数据看板",
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
    description: `线下活动报名表：姓名、手机、邮箱、场次选择、 dietary 备注。
前端校验、提交后展示确认页与报名号（随机生成），可「再报一人」。`,
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
  parts.push(`需求描述：\n${opts.description.slice(0, 4000)}`);
  if (opts.appType === "shortcuts" || opts.appType === "api") {
    parts.push(
      "",
      "再次强调：必须实现 URL 参数驱动 + format=json 纯 JSON 输出 + 快捷指令配置向导 + 复制按钮。",
    );
  }
  return parts.join("\n\n");
}

/**
 * @param {{ description: string, appType?: string, appName?: string, presetId?: string }} opts
 */
export async function generateAppHtml(opts) {
  const chatConfig = resolveChatConfig();
  if (!chatConfig) {
    throw new HttpError(
      503,
      "未配置 DEEPSEEK_API_KEY 或 ARK_API_KEY，无法生成应用。请在 .env 配置后重启。",
    );
  }

  const description = opts.description?.trim();
  if (!description) throw new HttpError(400, "请描述你想做的应用");

  const appType = opts.appType?.trim() || "tool";
  const appName = opts.appName?.trim();

  const timeoutMs = Number(env("APP_BUILDER_TIMEOUT_MS", "180000")) || 180000;
  const client = new OpenAI({
    apiKey: chatConfig.apiKey,
    baseURL: chatConfig.baseURL,
    timeout: timeoutMs,
    maxRetries: 0,
  });

  try {
    const completion = await client.chat.completions.create({
      model: chatConfig.model,
      messages: [
        { role: "system", content: buildSystemPrompt(appType) },
        { role: "user", content: buildUserPrompt({ description, appType, appName, presetId: opts.presetId }) },
      ],
      temperature: appType === "shortcuts" || appType === "api" ? 0.45 : 0.55,
      max_tokens: 8192,
    });

    const raw = completion.choices?.[0]?.message?.content?.trim();
    if (!raw) throw new HttpError(502, "AI 未返回有效内容");

    const html = stripMarkdownFences(raw);
    if (!/<!DOCTYPE\s+html/i.test(html) && !/<html[\s>]/i.test(html)) {
      throw new HttpError(502, "AI 返回的内容不是有效 HTML，请调整描述后重试");
    }

    return {
      html,
      title: extractTitle(html),
      provider: getChatProviderLabel(chatConfig.provider),
    };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    const msg = e?.message || String(e);
    if (/401|invalid.*key/i.test(msg)) {
      throw new HttpError(503, `${getChatProviderLabel(chatConfig.provider)} API Key 无效`);
    }
    if (/timeout|timed out|AbortError/i.test(msg)) {
      throw new HttpError(408, "生成超时，请简化描述后重试");
    }
    throw new HttpError(502, `应用生成失败：${msg.slice(0, 200)}`);
  }
}

export function listAppTypes() {
  return Object.entries(APP_TYPES).map(([id, { label, hint }]) => ({ id, label, hint }));
}

export function listAppPresets() {
  return APP_PRESETS.map(({ id, appType, appName, title, description }) => ({
    id,
    appType,
    appName,
    title,
    description,
    descriptionPreview: description.split("\n")[0].slice(0, 80),
  }));
}

export function getAppPreset(id) {
  return APP_PRESETS.find((p) => p.id === id) || null;
}
