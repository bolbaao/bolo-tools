import OpenAI from "openai";
import { HttpError } from "./http-error.mjs";
import { resolveChatConfig, getChatProviderLabel } from "./chat-config.mjs";
import { env } from "./env.mjs";

const APP_TYPES = {
  tool: "实用小工具（计算器、待办、计时器等）",
  landing: "产品落地页 / 宣传页",
  dashboard: "数据看板 / 管理面板",
  game: "轻量小游戏或互动页面",
  form: "表单 / 问卷 / 收集页",
};

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
  return "我的应用";
}

function buildSystemPrompt(appType) {
  const typeHint = APP_TYPES[appType] || APP_TYPES.tool;
  return `你是专业的前端工程师，为「菠萝工具箱 · 一键做 App」生成完整可运行的单页 Web 应用。

应用类型：${typeHint}

硬性要求：
1. 输出且仅输出一个完整 HTML 文档，以 <!DOCTYPE html> 开头
2. 所有 CSS 写在 <style> 内，所有 JS 写在 <script> 内；不依赖 npm、构建工具或本地文件
3. 可使用公共 CDN（如 Google Fonts），但核心功能必须在单文件内可运行
4. 界面现代、美观、移动端友好；深色或浅色主题与内容匹配
5. 功能完整可用：交互有反馈，必要数据可用 localStorage 或内存 mock
6. 不要使用 alert 作为主要 UI；用页面内提示
7. 不要输出 markdown 代码块，不要输出解释文字

安全：不要包含 eval、document.write、外链脚本加载用户输入。`;
}

/**
 * @param {{ description: string, appType?: string, appName?: string }} opts
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

  const userParts = [`需求描述：\n${description.slice(0, 4000)}`];
  if (appName) userParts.unshift(`应用名称：${appName}`);

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
        { role: "user", content: userParts.join("\n\n") },
      ],
      temperature: 0.55,
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
  return Object.entries(APP_TYPES).map(([id, label]) => ({ id, label }));
}
