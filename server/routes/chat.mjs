import { Router } from "express";
import OpenAI from "openai";
import { buildAgentSystemPrompt } from "../lib/agent-catalog.mjs";
import { env } from "../lib/env.mjs";
import { HttpError, sendError } from "../lib/http-error.mjs";

const router = Router();

const ARK_DEFAULT_BASE = "https://ark.cn-beijing.volces.com/api/v3";
const ARK_DEFAULT_MODEL = "doubao-1-5-pro-32k-250115";

const ALLOWED_ACTIONS = new Set(["navigate", "scroll", "filter_tools", "prefill"]);

function resolveChatConfig() {
  const arkKey = env("ARK_API_KEY") || env("VOLC_API_KEY");
  if (!arkKey) return null;

  return {
    apiKey: arkKey,
    baseURL: env("ARK_BASE_URL") || env("OPENAI_BASE_URL") || ARK_DEFAULT_BASE,
    model: env("ARK_MODEL") || env("OPENAI_MODEL") || ARK_DEFAULT_MODEL,
  };
}

function formatChatError(err) {
  const msg = err?.message || String(err);
  if (/InvalidEndpointOrModel|does not exist/i.test(msg)) {
    return "模型或接入点无效。请在 .env 设置 ARK_MODEL";
  }
  if (/timeout|timed out|ETIMEDOUT|AbortError|ECONNREFUSED|ENOTFOUND|fetch failed|Connection error/i.test(msg)) {
    return "无法连接火山方舟 API。请检查网络后重启 ./start.sh";
  }
  return msg;
}

function parseAgentJson(raw) {
  const text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : text;
  return JSON.parse(candidate);
}

function sanitizeActions(actions) {
  if (!Array.isArray(actions)) return [];
  return actions
    .filter((a) => a && typeof a === "object" && ALLOWED_ACTIONS.has(String(a.type)))
    .slice(0, 6)
    .map((a) => ({
      type: String(a.type),
      params: typeof a.params === "object" && a.params !== null ? a.params : {},
    }));
}

router.post("/", async (req, res) => {
  try {
    const { messages, pageContext } = req.body ?? {};
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new HttpError(400, "messages 不能为空");
    }

    const chatConfig = resolveChatConfig();
    if (!chatConfig) {
      throw new HttpError(
        503,
        "未配置 ARK_API_KEY。请在 .env 填入火山方舟 API Key",
      );
    }

    const timeoutMs = Number(env("CHAT_TIMEOUT_MS", "60000")) || 60000;
    const client = new OpenAI({
      apiKey: chatConfig.apiKey,
      baseURL: chatConfig.baseURL,
      timeout: timeoutMs,
      maxRetries: 0,
    });

    const completion = await client.chat.completions.create({
      model: chatConfig.model,
      messages: [
        {
          role: "system",
          content: buildAgentSystemPrompt(pageContext),
        },
        ...messages
          .map((m) => ({
            role: m.role === "user" ? "user" : "assistant",
            content: String(m.content ?? "").trim(),
          }))
          .filter((m) => m.content.length > 0),
      ],
      temperature: 0.4,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    });

    const choice = completion.choices[0]?.message;
    const raw =
      choice?.content?.trim() ||
      (typeof choice?.reasoning_content === "string" ? choice.reasoning_content.trim() : "");

    if (!raw) throw new HttpError(502, "AI 未返回有效内容");

    let parsed;
    try {
      parsed = parseAgentJson(raw);
    } catch {
      res.json({
        ok: true,
        reply: raw,
        intent: "chat",
        plan: [],
        actions: [],
      });
      return;
    }

    const reply = String(parsed.reply ?? parsed.message ?? "好的，我来帮你。").trim();
    const intent = parsed.intent === "operate" ? "operate" : "chat";
    const plan = Array.isArray(parsed.plan)
      ? parsed.plan.map((s) => String(s)).filter(Boolean).slice(0, 6)
      : [];
    const actions = sanitizeActions(parsed.actions);

    res.json({
      ok: true,
      reply,
      intent,
      plan,
      actions,
    });
  } catch (err) {
    if (!(err instanceof HttpError)) {
      sendError(res, new HttpError(502, formatChatError(err)));
      return;
    }
    sendError(res, err);
  }
});

export default router;
