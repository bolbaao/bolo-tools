import OpenAI from "openai";
import { HttpError } from "./http-error.mjs";
import { buildPptxBuffer } from "./pptx-builder.mjs";
import { resolveChatConfig, getChatProviderLabel } from "./chat-config.mjs";
import { env } from "./env.mjs";
import { parseJsonBlock } from "./parse-json-block.mjs";

function sanitizeFilename(name) {
  const base = String(name || "演示文稿")
    .replace(/\.pptx?$/i, "")
    .replace(/[^\w\u4e00-\u9fff-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "演示文稿";
}

function assertPptxBuffer(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf || []);
  // .pptx 为 ZIP 格式，文件头 PK
  if (b.length < 4 || b[0] !== 0x50 || b[1] !== 0x4b) {
    throw new HttpError(502, "PPT 文件生成失败，请重试");
  }
  return b;
}

function normalizeSlides(parsed, fallbackTopic) {
  const deckTitle = String(parsed.title || parsed.topic || fallbackTopic || "演示文稿").trim();
  const rawSlides = Array.isArray(parsed.slides) ? parsed.slides : [];
  const slides = rawSlides
    .map((s, i) => {
      const title = String(s?.title || s?.heading || `第 ${i + 1} 页`).trim();
      const bullets = Array.isArray(s?.bullets)
        ? s.bullets.map((b) => String(b || "").trim()).filter(Boolean)
        : Array.isArray(s?.points)
          ? s.points.map((b) => String(b || "").trim()).filter(Boolean)
          : String(s?.content || "")
              .split(/\n+/)
              .map((b) => b.replace(/^[-*•]\s*/, "").trim())
              .filter(Boolean);
      const body = String(s?.body || s?.content || "").trim();
      return { title, bullets, body };
    })
    .filter((s) => s.title || s.bullets.length || s.body);

  if (!slides.length) {
    throw new HttpError(502, "AI 未生成有效幻灯片内容");
  }

  return { deckTitle, slides };
}

async function planSlidesWithLLM(topic, opts = {}) {
  const chatConfig = resolveChatConfig();
  if (!chatConfig) {
    throw new HttpError(503, "未配置 DEEPSEEK_API_KEY 或 ARK_API_KEY，无法生成 PPT");
  }

  const client = new OpenAI({
    apiKey: chatConfig.apiKey,
    baseURL: chatConfig.baseURL,
    timeout: Number(env("PPT_GENERATE_TIMEOUT_MS", "120000")) || 120000,
    maxRetries: 0,
  });

  const historyBlock = (Array.isArray(opts.history) ? opts.history : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && String(m.content || "").trim())
    .slice(-8)
    .map((m) => `${m.role === "user" ? "用户" : "助手"}：${String(m.content).trim().slice(0, 600)}`)
    .join("\n\n");

  const completion = await client.chat.completions.create({
    model: chatConfig.model,
    temperature: 0.45,
    max_tokens: 4096,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `你是专业 PPT 策划与撰稿助手。根据用户需求生成演示文稿结构。

只输出 JSON：
{
  "title": "演示文稿总标题（简短、准确）",
  "slides": [
    { "title": "页标题", "bullets": ["要点1", "要点2"] }
  ]
}

要求：
1. 8-12 页，第一页为封面（标题+副标题式要点），最后一页为总结或致谢
2. 每页 3-5 条简洁要点，中文，适合投影阅读
3. title 必须是用户主题，不要用「未命名」「演示文稿」等泛称
4. 不要输出 markdown、解释或 JSON 以外的内容`,
      },
      {
        role: "user",
        content: historyBlock
          ? `对话上下文：\n${historyBlock}\n\n请为以下需求生成 PPT：\n${topic}`
          : `请为以下需求生成 PPT：\n${topic}`,
      },
    ],
  });

  let parsed;
  try {
    parsed = parseJsonBlock(completion.choices?.[0]?.message?.content || "{}");
  } catch {
    throw new HttpError(502, "AI 返回的 PPT 结构无效，请重试");
  }

  return normalizeSlides(parsed, topic);
}

async function renderPptx({ deckTitle, slides }) {
  return buildPptxBuffer({
    title: deckTitle,
    slides: slides.map((slide) => ({
      title: slide.title,
      bullets: slide.bullets?.length
        ? slide.bullets
        : slide.body
          ? slide.body.split(/\n+/).filter(Boolean)
          : [],
    })),
  });
}

/**
 * @param {string} topic
 * @param {{ history?: {role:string,content:string}[] }} opts
 */
export async function generatePptx(topic, opts = {}) {
  const q = String(topic || "").trim();
  if (!q) throw new HttpError(400, "请说明 PPT 主题或内容");

  try {
    const plan = await planSlidesWithLLM(q, opts);
    const buffer = assertPptxBuffer(await renderPptx(plan));
    const filename = `${sanitizeFilename(plan.deckTitle)}.pptx`;
    return {
      buffer,
      filename,
      contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      title: plan.deckTitle,
      slideCount: plan.slides.length,
    };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    const msg = e?.message || String(e);
    if (/401|invalid.*key/i.test(msg)) {
      throw new HttpError(503, `${getChatProviderLabel(resolveChatConfig()?.provider)} API Key 无效`);
    }
    if (/timeout|timed out|AbortError/i.test(msg)) {
      throw new HttpError(408, "PPT 生成超时，请简化主题后重试");
    }
    throw new HttpError(502, `PPT 生成失败：${msg.slice(0, 200)}`);
  }
}
