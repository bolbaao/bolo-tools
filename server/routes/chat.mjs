import { Router } from "express";
import OpenAI from "openai";
import { env } from "../lib/env.mjs";
import { HttpError, sendError } from "../lib/http-error.mjs";

const router = Router();

const ARK_DEFAULT_BASE = "https://ark.cn-beijing.volces.com/api/v3";
const ARK_DEFAULT_MODEL = "doubao-1-5-pro-32k-250115";

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
    return "模型或接入点无效。请在 .env 设置 ARK_MODEL（火山方舟控制台中的模型 ID 或 ep-xxx）";
  }
  if (/timeout|timed out|ETIMEDOUT|AbortError|ECONNREFUSED|ENOTFOUND|fetch failed|Connection error/i.test(msg)) {
    return "无法连接火山方舟 API。请检查网络后重启 ./start.sh";
  }
  return msg;
}

router.post("/", async (req, res) => {
  try {
    const { messages } = req.body ?? {};
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new HttpError(400, "messages 不能为空");
    }

    const chatConfig = resolveChatConfig();
    if (!chatConfig) {
      throw new HttpError(
        503,
        "未配置 ARK_API_KEY。请在 .env 填入火山方舟 API Key（https://console.volcengine.com/ark）",
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
          content:
            "你是轻松友好的闲聊伙伴。用口语化中文回复，简短自然，像朋友聊天。不要扮演专家或顾问，不要列长清单。",
        },
        ...messages
          .map((m) => ({
            role: m.role === "user" ? "user" : "assistant",
            content: String(m.content ?? "").trim(),
          }))
          .filter((m) => m.content.length > 0),
      ],
      temperature: 0.85,
      max_tokens: 512,
    });

    const choice = completion.choices[0]?.message;
    const reply =
      choice?.content?.trim() ||
      (typeof choice?.reasoning_content === "string" ? choice.reasoning_content.trim() : "");
    if (!reply) throw new HttpError(502, "AI 未返回有效内容");

    res.json({ ok: true, reply });
  } catch (err) {
    if (!(err instanceof HttpError)) {
      sendError(res, new HttpError(502, formatChatError(err)));
      return;
    }
    sendError(res, err);
  }
});

export default router;
