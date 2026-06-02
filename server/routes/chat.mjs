import { Router } from "express";
import multer from "multer";
import OpenAI from "openai";
import { extractDocumentText } from "../lib/chat-document-extract.mjs";
import { AGENT_PERMISSION_TYPES } from "../lib/agent-permissions-catalog.mjs";
import { buildAgentSystemPrompt } from "../lib/agent-catalog.mjs";
import {
  describeAiStack,
  getChatProviderLabel,
  listAvailableChatModels,
  resolveChatConfig,
} from "../lib/chat-config.mjs";
import { resolveChatConfigForRequest } from "../lib/chat-provider-routing.mjs";
import { env } from "../lib/env.mjs";
import { HttpError, sendError } from "../lib/http-error.mjs";
import {
  chatImageVisionPayload,
  formatChatImagesForPrompt,
  formatPhotoSnapshotForPrompt,
  resolveAllImageContext,
} from "../lib/photo-vision.mjs";
import { pageContextNeedsVisionApi } from "../../shared/chat-image-vision.mjs";
import { formatWeatherForPrompt, resolveWeatherSnapshot } from "../lib/weather.mjs";
import { getAuthUserFromRequest } from "../lib/user-auth.mjs";
import { formatMemoriesForPrompt } from "../lib/user-memory.mjs";

const router = Router();
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
});

const ALLOWED_ACTIONS = new Set(["navigate", "scroll", "filter_tools", "prefill"]);
const ALLOWED_PERMISSIONS = new Set(AGENT_PERMISSION_TYPES);

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
    return "AI 模型暂时不可用，请稍后再试";
  }
  if (/timeout|timed out|ETIMEDOUT|AbortError|ECONNREFUSED|ENOTFOUND|fetch failed|Connection error/i.test(msg)) {
    return "AI 服务连接超时，请检查网络后稍后再试";
  }
  if (/401|invalid.*key|authentication/i.test(msg)) {
    return "AI 服务暂时不可用，请稍后再试";
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

router.post("/extract-document", documentUpload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file?.buffer?.length) throw new HttpError(400, "请上传 PDF 或 Word 文件");
    const result = await extractDocumentText(file.buffer, file.originalname);
    res.json({ ok: true, file: result });
  } catch (err) {
    sendError(res, err);
  }
});

router.get("/models", (_req, res) => {
  const models = listAvailableChatModels();
  const defaultCfg = resolveChatConfig();
  const aiStack = describeAiStack();
  res.json({
    ok: true,
    models,
    defaultProvider: defaultCfg?.provider ?? null,
    imageVision: aiStack.vision.configured,
    aiStack,
  });
});

router.post("/", async (req, res) => {
  let chatConfig = null;
  try {
    const { messages, pageContext, provider, mode: rawMode } = req.body ?? {};
    const chatMode = rawMode === "chat" ? "chat" : "agent";
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new HttpError(400, "messages 不能为空");
    }

    const normalizedMessages = messages
      .map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: String(m.content ?? "").trim().slice(0, 8000),
      }))
      .filter((m) => m.content.length > 0)
      .slice(-20);

    chatConfig = resolveChatConfigForRequest({
      requestedProvider: provider,
      mode: chatMode,
      messages: normalizedMessages,
      pageContext,
    });
    if (!chatConfig) {
      throw new HttpError(
        503,
        "未配置 AI 对话 Key。请在 .env 填入 DEEPSEEK_API_KEY（推荐）；识图需单独配置 ARK_VISION_API_KEY，详见 .env.example",
      );
    }

    const defaultTimeout = pageContextNeedsVisionApi(pageContext) ? 120000 : 60000;
    const timeoutMs = Number(env("CHAT_TIMEOUT_MS", String(defaultTimeout))) || defaultTimeout;
    const client = new OpenAI({
      apiKey: chatConfig.apiKey,
      baseURL: chatConfig.baseURL,
      timeout: timeoutMs,
      maxRetries: 0,
    });

    const weatherResult = await resolveWeatherSnapshot({
      messages: normalizedMessages,
      pageContext,
    });
    const lastUserText =
      [...normalizedMessages].reverse().find((m) => m.role === "user")?.content ?? "";
    const { chatSnap, albumSnap } = await resolveAllImageContext(pageContext, {
      userContext: lastUserText,
    });
    const authUser = getAuthUserFromRequest(req);
    const userMemorySnapshot =
      authUser?.emailVerified ? formatMemoriesForPrompt(authUser.id) : "";

    const enrichedContext = {
      ...(pageContext && typeof pageContext === "object" ? pageContext : {}),
      weatherSnapshot: formatWeatherForPrompt(weatherResult),
      photoSnapshot: formatPhotoSnapshotForPrompt(albumSnap),
      chatImagesSnapshot: formatChatImagesForPrompt(chatSnap),
      userMemorySnapshot,
    };

    let systemPrompt = buildAgentSystemPrompt(enrichedContext, chatMode);
    if (userMemorySnapshot) {
      systemPrompt = `${systemPrompt}\n\n${userMemorySnapshot}`;
    }

    const chatMessages = [
      {
        role: "system",
        content: systemPrompt,
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
        chatImageVision: chatImageVisionPayload(chatSnap),
        provider: chatConfig.provider,
        model: chatConfig.model,
        providerLabel: getChatProviderLabel(chatConfig.provider),
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
      chatImageVision: chatImageVisionPayload(chatSnap),
      provider: chatConfig.provider,
      model: chatConfig.model,
      providerLabel: getChatProviderLabel(chatConfig.provider),
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
