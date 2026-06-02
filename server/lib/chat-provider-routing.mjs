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

  const hasDeepseek = providerConfigured("deepseek");
  const hasArk = providerConfigured("ark");
  if (!hasDeepseek && !hasArk) return null;

  // 合并栈：有 DeepSeek 时文字对话固定走 DeepSeek；识图由 photo-vision 走火山方舟
  if (hasDeepseek) return "deepseek";

  const explicit = String(requestedProvider ?? "")
    .trim()
    .toLowerCase();
  if (explicit && explicit !== "auto" && providerConfigured(explicit)) {
    return explicit;
  }

  if (hasArk) return "ark";

  const userText = lastUserText(messages);
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
