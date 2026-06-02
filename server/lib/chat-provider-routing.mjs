import { env } from "./env.mjs";
import { deepseekConfig, resolveArkConfig, resolveChatConfig } from "./chat-config.mjs";

const TASK_HINT =
  /(?:https?:\/\/|www\.|下载|提取|解析|转换|生成|制作|剪辑|配音|字幕|搜索|找(?:一下)?|帮我|打开|跳转|预填|写作|写一|润色|扩写|翻译|做(?:个|一)?app|全网搜|网盘|视频链接|抖音|b站|小红书)/i;

function providerConfigured(id) {
  if (id === "deepseek") return Boolean(deepseekConfig());
  if (id === "ark") return Boolean(resolveArkConfig());
  return false;
}

function lastUserText(messages) {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === "user") return String(m.content ?? "").trim();
  }
  return "";
}

/** @returns {"deepseek"|"ark"|null} */
export function pickChatProviderForRequest({
  requestedProvider,
  mode = "agent",
  messages,
  pageContext,
} = {}) {
  const forced = env("CHAT_PROVIDER").toLowerCase();
  if (forced === "deepseek" || forced === "ark") {
    return providerConfigured(forced) ? forced : null;
  }

  const explicit = String(requestedProvider ?? "")
    .trim()
    .toLowerCase();
  if (explicit && explicit !== "auto" && providerConfigured(explicit)) {
    return explicit;
  }

  const hasDeepseek = providerConfigured("deepseek");
  const hasArk = providerConfigured("ark");
  if (!hasDeepseek && !hasArk) return null;
  if (hasDeepseek && !hasArk) return "deepseek";
  if (hasArk && !hasDeepseek) return "ark";

  const userText = lastUserText(messages);

  // 附图识图由 photo-vision.mjs 单独调用火山方舟视觉 API，结果以文字注入 system prompt；
  // 对话生成仍优先 DeepSeek，避免方舟聊天模型不可用时整段请求失败。

  if (mode === "agent" || TASK_HINT.test(userText)) {
    return "deepseek";
  }

  return "deepseek";
}

/** @returns {{ provider: string, apiKey: string, baseURL: string, model: string } | null} */
export function resolveChatConfigForRequest(opts) {
  const picked = pickChatProviderForRequest(opts);
  if (!picked) return resolveChatConfig();
  if (picked === "deepseek") return deepseekConfig();
  if (picked === "ark") return resolveArkConfig();
  return resolveChatConfig();
}
