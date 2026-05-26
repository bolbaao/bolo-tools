import { randomUUID } from "crypto";
import { Router } from "express";
import OpenAI from "openai";
import { env } from "../lib/env.mjs";
import {
  buildChatPrompt,
  isGrokCliReady,
  runGrokCli,
} from "../lib/grok-cli.mjs";
import { HttpError, sendError } from "../lib/http-error.mjs";

const router = Router();

const XAI_DEFAULT_BASE = "https://api.x.ai/v1";
const XAI_DEFAULT_MODEL = "grok-4-1-fast";

function useGrokCli() {
  const flag = env("GROK_USE_CLI").toLowerCase();
  if (flag === "1" || flag === "true" || flag === "yes") return true;
  if (flag === "0" || flag === "false" || flag === "no") return false;
  return !resolveChatConfig();
}

function resolveChatConfig() {
  const xaiKey = env("XAI_API_KEY") || env("GROK_API_KEY");
  if (xaiKey) {
    return {
      apiKey: xaiKey,
      baseURL: env("XAI_BASE_URL") || env("OPENAI_BASE_URL") || XAI_DEFAULT_BASE,
      model:
        env("XAI_MODEL") ||
        env("GROK_MODEL") ||
        env("OPENAI_MODEL") ||
        XAI_DEFAULT_MODEL,
    };
  }

  const openaiKey = env("OPENAI_API_KEY");
  if (openaiKey) {
    return {
      apiKey: openaiKey,
      baseURL: env("OPENAI_BASE_URL") || undefined,
      model: env("OPENAI_MODEL") || "gpt-4o-mini",
    };
  }

  return null;
}

router.post("/", async (req, res) => {
  try {
    const { messages, sessionId: clientSessionId } = req.body ?? {};
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new HttpError(400, "messages 不能为空");
    }

    if (useGrokCli()) {
      if (!isGrokCliReady()) {
        throw new HttpError(
          503,
          "Grok CLI 未就绪。请运行：curl -fsSL https://x.ai/cli/install.sh | bash，然后 grok login；或在 .env 配置 XAI_API_KEY",
        );
      }

      const sessionId =
        typeof clientSessionId === "string" && clientSessionId.trim()
          ? clientSessionId.trim()
          : randomUUID();

      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      const prompt =
        clientSessionId && messages.length > 1
          ? String(lastUser?.content ?? "").trim()
          : buildChatPrompt(messages);

      if (!prompt) throw new HttpError(400, "messages 不能为空");

      const model =
        env("XAI_MODEL") || env("GROK_MODEL") || env("OPENAI_MODEL") || "";
      const reply = await runGrokCli({
        prompt,
        sessionId,
        model: model || undefined,
      });

      res.json({ ok: true, reply, sessionId });
      return;
    }

    const chatConfig = resolveChatConfig();
    if (!chatConfig) {
      throw new HttpError(
        503,
        "未配置 AI。请安装 Grok CLI（./scripts/install-grok-cli.sh + grok login）或设置 XAI_API_KEY / OPENAI_API_KEY",
      );
    }

    const client = new OpenAI({
      apiKey: chatConfig.apiKey,
      baseURL: chatConfig.baseURL,
    });

    const model = chatConfig.model;
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "你是轻松友好的闲聊伙伴。用口语化中文回复，简短自然，像朋友聊天。不要扮演专家或顾问，不要列长清单。",
        },
        ...messages.map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: String(m.content ?? ""),
        })),
      ],
      temperature: 0.85,
      max_tokens: 512,
    });

    const reply = completion.choices[0]?.message?.content?.trim();
    if (!reply) throw new HttpError(502, "AI 未返回有效内容");

    res.json({ ok: true, reply });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
