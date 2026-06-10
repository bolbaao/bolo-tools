import OpenAI from "openai";
import { HttpError } from "./http-error.mjs";
import {
  deepseekConfig,
  describeAiStack,
  getChatProviderLabel,
  resolveArkConfig,
  resolveChatConfigByProvider,
} from "./chat-config.mjs";
import { env } from "./env.mjs";
import { buildAgentSystemPrompt, parseAgentAction } from "./chat-agent.mjs";
import { mergeToolResultIntoReply } from "./chat-tool-runner.mjs";
import { tryImageFetchReply } from "./chat-image-intent.mjs";
import { tryPptGenerateReply } from "./chat-ppt-intent.mjs";
import { tryMediaSearchReply } from "./chat-media-intent.mjs";
import { trySubtitleToolReply } from "./chat-subtitle-intent.mjs";
import {
  buildAttachmentContext,
  getChatAttachmentCapabilities,
  processChatUploadFiles,
} from "./chat-attachments.mjs";
import { verifyAssistantReply } from "./chat-thinking.mjs";

const CHAT_SYSTEM = `你是春雨集的工作区 AI 助手，帮助用户处理创作、工具使用与日常问题。
要求：用中文回答，简洁实用；若用户在使用某工具，可结合上下文给出操作建议；不要编造无法验证的事实。`;

/**
 * @param {{ role: string, content: string }[]} messages
 * @param {{ provider?: string, mode?: string, pageContext?: object, chatFiles?: object[], rawFiles?: object[], userId?: string, isAdmin?: boolean }} opts
 */
export async function runWorkspaceChat(messages, opts = {}) {
  const chatConfig = resolveChatConfigByProvider(opts.provider);
  if (!chatConfig) {
    throw new HttpError(
      503,
      "未配置 DEEPSEEK_API_KEY 或 ARK_API_KEY。请在 .env 配置后重启。",
    );
  }

  const history = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && String(m.content || "").trim())
    .slice(-20)
    .map((m) => ({
      role: m.role,
      content: String(m.content).trim().slice(0, 12000),
    }));

  if (!history.length || history[history.length - 1].role !== "user") {
    throw new HttpError(400, "请发送一条有效消息");
  }

  const lastUser = history.filter((m) => m.role === "user").pop()?.content || "";
  const mode = opts.mode === "agent" ? "agent" : "chat";

  const chatFiles = [
    ...(Array.isArray(opts.chatFiles) ? opts.chatFiles : []),
    ...(Array.isArray(opts.pageContext?.chatFiles) ? opts.pageContext.chatFiles : []),
  ];
  const rawFiles = Array.isArray(opts.rawFiles) ? opts.rawFiles : [];
  const userId = opts.userId;
  const isAdmin = Boolean(opts.isAdmin);

  const pptReply = await tryPptGenerateReply(lastUser, history);
  if (pptReply) {
    return {
      reply: pptReply,
      provider: chatConfig.provider,
      providerLabel: getChatProviderLabel(chatConfig.provider),
      model: chatConfig.model,
      mode,
      chatImageVision: [],
      chatFiles: chatFiles.map((f) => ({
        name: f.name,
        kind: f.kind,
        description: f.description,
        transcript: f.transcript ? `${f.transcript.slice(0, 200)}…` : undefined,
        contentPreview: f.content ? `${f.content.slice(0, 120)}…` : undefined,
        metadata: f.metadata,
        error: f.error,
      })),
      agentAction: null,
    };
  }

  if (!chatFiles.length) {
    const imageReply = await tryImageFetchReply(lastUser, history);
    if (imageReply) {
      return {
        reply: imageReply,
        provider: chatConfig.provider,
        providerLabel: getChatProviderLabel(chatConfig.provider),
        model: chatConfig.model,
        mode,
        chatImageVision: [],
        chatFiles: [],
        agentAction: null,
      };
    }

    const mediaReply = await tryMediaSearchReply(lastUser);
    if (mediaReply) {
      return {
        reply: mediaReply,
        provider: chatConfig.provider,
        providerLabel: getChatProviderLabel(chatConfig.provider),
        model: chatConfig.model,
        mode,
        chatImageVision: [],
        chatFiles: [],
        agentAction: null,
      };
    }
  }

  const subtitleReply = await trySubtitleToolReply(lastUser, { rawFiles, userId });
  if (subtitleReply) {
    return {
      reply: subtitleReply,
      provider: chatConfig.provider,
      providerLabel: getChatProviderLabel(chatConfig.provider),
      model: chatConfig.model,
      mode,
      chatImageVision: [],
      chatFiles: chatFiles.map((f) => ({
        name: f.name,
        kind: f.kind,
        description: f.description,
        transcript: f.transcript ? `${f.transcript.slice(0, 200)}…` : undefined,
        contentPreview: f.content ? `${f.content.slice(0, 120)}…` : undefined,
        metadata: f.metadata,
        error: f.error,
      })),
      agentAction: null,
    };
  }

  const { fileBlock, imageBlock, chatImageVision } = await buildAttachmentContext(
    chatFiles,
    lastUser,
    opts.pageContext?.chatImages,
  );

  const pathHint = opts.pageContext?.path
    ? `\n当前页面：${String(opts.pageContext.path).slice(0, 200)}`
    : "";

  const system =
    mode === "agent"
      ? `${buildAgentSystemPrompt(isAdmin)}${pathHint}${fileBlock}${imageBlock}`
      : `${CHAT_SYSTEM}${pathHint}${fileBlock}${imageBlock}`;

  const timeoutMs = Number(env("CHAT_TIMEOUT_MS", "120000")) || 120000;
  const client = new OpenAI({
    apiKey: chatConfig.apiKey,
    baseURL: chatConfig.baseURL,
    timeout: timeoutMs,
    maxRetries: 0,
  });

  try {
    const completion = await client.chat.completions.create({
      model: chatConfig.model,
      messages: [{ role: "system", content: system }, ...history],
      temperature: mode === "agent" ? 0.45 : 0.65,
      max_tokens: 2048,
    });

    let reply = completion.choices?.[0]?.message?.content?.trim() || "";
    if (!reply) throw new HttpError(502, "AI 未返回有效回复");

    let agentAction = null;
    if (mode === "agent") {
      const verified = await verifyAssistantReply(client, chatConfig, {
        userMessage: lastUser,
        reply,
      });
      reply = verified.reply;

      const parsed = parseAgentAction(reply, isAdmin);
      reply = parsed.reply;
      agentAction = parsed.agentAction;
      if (agentAction) {
        const merged = await mergeToolResultIntoReply(reply, agentAction, {
          lastUserMessage: lastUser,
          chatFiles,
          rawFiles,
          userId,
          isAdmin,
          history,
        });
        reply = merged.reply;
        agentAction = merged.agentAction;
      }
    }

    return {
      reply,
      provider: chatConfig.provider,
      providerLabel: getChatProviderLabel(chatConfig.provider),
      model: chatConfig.model,
      mode,
      chatImageVision,
      chatFiles: chatFiles.map((f) => ({
        name: f.name,
        kind: f.kind,
        description: f.description,
        transcript: f.transcript ? `${f.transcript.slice(0, 200)}…` : undefined,
        contentPreview: f.content ? `${f.content.slice(0, 120)}…` : undefined,
        metadata: f.metadata,
        error: f.error,
      })),
      agentAction,
    };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    const msg = e?.message || String(e);
    if (/401|invalid.*key/i.test(msg)) {
      throw new HttpError(503, "AI API Key 无效，请检查配置");
    }
    throw new HttpError(502, `对话失败：${msg.slice(0, 200)}`);
  }
}

export { processChatUploadFiles };

export function getWorkspaceChatCapabilities() {
  const stack = describeAiStack();
  const ds = deepseekConfig();
  const ark = resolveArkConfig();
  const attachments = getChatAttachmentCapabilities();

  const allModels = [];
  if (ds) {
    allModels.push({
      id: "deepseek",
      label: stack.merged ? "DeepSeek（对话）" : "DeepSeek",
      model: ds.model,
    });
  }
  if (ark) {
    allModels.push({
      id: "ark",
      label: stack.merged ? "火山方舟（对话）" : "火山方舟",
      model: ark.model,
    });
  }

  return {
    available: allModels.length > 0,
    models: allModels,
    defaultProvider: stack.chat.provider || allModels[0]?.id || null,
    vision: {
      configured: stack.vision.configured,
      label: stack.vision.label,
    },
    merged: stack.merged,
    agent: allModels.length > 0,
    attachments,
  };
}
