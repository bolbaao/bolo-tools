import { Router } from "express";
import OpenAI from "openai";
import { AGENT_PERMISSION_TYPES } from "../lib/agent-permissions-catalog.mjs";
import { buildAgentSystemPrompt } from "../lib/agent-catalog.mjs";
import { env } from "../lib/env.mjs";
import { HttpError, sendError } from "../lib/http-error.mjs";
import {
  formatChatImagesForPrompt,
  formatPhotoSnapshotForPrompt,
  resolveAllImageContext,
} from "../lib/photo-vision.mjs";
import { formatWeatherForPrompt, resolveWeatherSnapshot } from "../lib/weather.mjs";

const router = Router();

const DEEPSEEK_DEFAULT_BASE = "https://api.deepseek.com/v1";
const DEEPSEEK_DEFAULT_MODEL = "deepseek-chat";
const ARK_DEFAULT_BASE = "https://ark.cn-beijing.volces.com/api/v3";
const ARK_DEFAULT_MODEL = "doubao-1-5-pro-32k-250115";

const ALLOWED_ACTIONS = new Set(["navigate", "scroll", "filter_tools", "prefill"]);
const ALLOWED_PERMISSIONS = new Set(AGENT_PERMISSION_TYPES);

function resolveChatConfig() {
  const deepseekKey = env("DEEPSEEK_API_KEY");
  if (deepseekKey) {
    return {
      provider: "deepseek",
      apiKey: deepseekKey,
      baseURL: env("DEEPSEEK_BASE_URL") || DEEPSEEK_DEFAULT_BASE,
      model: env("DEEPSEEK_MODEL") || DEEPSEEK_DEFAULT_MODEL,
    };
  }

  const arkKey = env("ARK_API_KEY") || env("VOLC_API_KEY");
  if (arkKey) {
    return {
      provider: "ark",
      apiKey: arkKey,
      baseURL: env("ARK_BASE_URL") || ARK_DEFAULT_BASE,
      model: env("ARK_MODEL") || ARK_DEFAULT_MODEL,
    };
  }

  const openaiKey = env("OPENAI_API_KEY");
  if (openaiKey) {
    return {
      provider: "openai",
      apiKey: openaiKey,
      baseURL: env("OPENAI_BASE_URL") || "https://api.openai.com/v1",
      model: env("OPENAI_MODEL") || "gpt-4o-mini",
    };
  }

  return null;
}

function normalizeMessageContent(content) {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && typeof part.text === "string") return part.text;
        return "";
      })
      .join("")
      .trim();
  }
  return "";
}

function extractChoiceText(choice) {
  const msg = choice?.message;
  if (!msg) return { raw: "", finishReason: choice?.finish_reason ?? null };

  const raw =
    normalizeMessageContent(msg.content) ||
    (typeof msg.reasoning_content === "string" ? msg.reasoning_content.trim() : "");

  return { raw, finishReason: choice.finish_reason ?? null };
}

function formatChatError(err) {
  const msg = err?.message || String(err);
  if (/InvalidEndpointOrModel|does not exist|model.*not found/i.test(msg)) {
    return "模型无效。请在 .env 设置 DEEPSEEK_MODEL（如 deepseek-chat）";
  }
  if (/timeout|timed out|ETIMEDOUT|AbortError|ECONNREFUSED|ENOTFOUND|fetch failed|Connection error/i.test(msg)) {
    return "无法连接 DeepSeek API。请检查网络与 API Key 后重启 ./start.sh";
  }
  if (/401|invalid.*key|authentication/i.test(msg)) {
    return "DeepSeek API Key 无效或已过期";
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

function sanitizePermissionRequests(requests) {
  if (!Array.isArray(requests)) return [];
  const seen = new Set();
  return requests
    .filter((r) => r && typeof r === "object" && ALLOWED_PERMISSIONS.has(String(r.type)))
    .filter((r) => {
      const t = String(r.type);
      if (seen.has(t)) return false;
      seen.add(t);
      return true;
    })
    .slice(0, AGENT_PERMISSION_TYPES.length)
    .map((r) => ({
      type: String(r.type),
      reason: String(r.reason ?? "").trim().slice(0, 200) || undefined,
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
        "未配置 DEEPSEEK_API_KEY。请在 .env 填入 DeepSeek API Key（https://platform.deepseek.com）",
      );
    }

    const hasPhotoUpload =
      (pageContext?.clientPermissions?.photos?.status === "granted" &&
        pageContext?.clientPermissions?.photos?.items?.some((p) => p?.previewDataUrl)) ||
      (Array.isArray(pageContext?.chatImages) &&
        pageContext.chatImages.some((p) => p?.previewDataUrl));
    const defaultTimeout = hasPhotoUpload ? 120000 : 60000;
    const timeoutMs = Number(env("CHAT_TIMEOUT_MS", String(defaultTimeout))) || defaultTimeout;
    const client = new OpenAI({
      apiKey: chatConfig.apiKey,
      baseURL: chatConfig.baseURL,
      timeout: timeoutMs,
      maxRetries: 0,
    });

    const normalizedMessages = messages
      .map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: String(m.content ?? "").trim().slice(0, 8000),
      }))
      .filter((m) => m.content.length > 0)
      .slice(-20);

    const weatherResult = await resolveWeatherSnapshot({
      messages: normalizedMessages,
      pageContext,
    });
    const { chatSnap, albumSnap } = await resolveAllImageContext(pageContext);
    const enrichedContext = {
      ...(pageContext && typeof pageContext === "object" ? pageContext : {}),
      weatherSnapshot: formatWeatherForPrompt(weatherResult),
      photoSnapshot: formatPhotoSnapshotForPrompt(albumSnap),
      chatImagesSnapshot: formatChatImagesForPrompt(chatSnap),
    };

    const chatMessages = [
      {
        role: "system",
        content: buildAgentSystemPrompt(enrichedContext),
      },
      ...normalizedMessages,
    ];

    const baseParams = {
      model: chatConfig.model,
      messages: chatMessages,
      temperature: 0.75,
      max_tokens: 2048,
    };

    let completion = await client.chat.completions.create({
      ...baseParams,
      response_format: { type: "json_object" },
    });

    let { raw, finishReason } = extractChoiceText(completion.choices[0]);

    if (!raw) {
      completion = await client.chat.completions.create(baseParams);
      ({ raw, finishReason } = extractChoiceText(completion.choices[0]));
    }

    if (!raw) {
      if (finishReason === "content_filter") {
        throw new HttpError(502, "内容未通过模型安全审核，请换种说法试试");
      }
      if (finishReason === "length") {
        throw new HttpError(502, "回复过长被截断，请清空对话后重试");
      }
      throw new HttpError(
        502,
        `AI 未返回有效内容（模型 ${chatConfig.model}，finish=${finishReason ?? "unknown"}）。请稍后重试或检查 API 余额`,
      );
    }

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
        permissionRequests: [],
      });
      return;
    }

    const reply = String(parsed.reply ?? parsed.message ?? raw).trim() || "好的，我来帮你。";
    const intent = parsed.intent === "operate" ? "operate" : "chat";
    const plan = Array.isArray(parsed.plan)
      ? parsed.plan.map((s) => String(s)).filter(Boolean).slice(0, 6)
      : [];
    const actions = sanitizeActions(parsed.actions);
    const permissionRequests = sanitizePermissionRequests(parsed.permissionRequests);

    res.json({
      ok: true,
      reply,
      intent,
      plan,
      actions,
      permissionRequests,
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
