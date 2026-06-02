import { env } from "./env.mjs";

const DEEPSEEK_DEFAULT_BASE = "https://api.deepseek.com/v1";
const DEEPSEEK_DEFAULT_MODEL = "deepseek-chat";
const ARK_DEFAULT_BASE = "https://ark.cn-beijing.volces.com/api/v3";
const ARK_DEFAULT_MODEL = "doubao-1-5-pro-32k-250115";
export const ARK_VISION_MODEL_DEFAULT = "doubao-1-5-vision-pro-32k-250115";

export function deepseekConfig() {
  const apiKey = env("DEEPSEEK_API_KEY");
  if (!apiKey) return null;
  return {
    provider: "deepseek",
    apiKey,
    baseURL: env("DEEPSEEK_BASE_URL") || DEEPSEEK_DEFAULT_BASE,
    model: env("DEEPSEEK_MODEL") || DEEPSEEK_DEFAULT_MODEL,
  };
}

/** @returns {{ provider: string, apiKey: string, baseURL: string, model: string } | null} */
export function resolveArkConfig() {
  const apiKey = env("ARK_API_KEY") || env("VOLC_API_KEY");
  if (!apiKey) return null;
  return {
    provider: "ark",
    apiKey,
    baseURL: (env("ARK_BASE_URL") || ARK_DEFAULT_BASE).replace(/\/$/, ""),
    model: env("ARK_MODEL") || ARK_DEFAULT_MODEL,
  };
}

/** 识图专用 Key：优先 ARK_VISION_API_KEY，回退 ARK_API_KEY / VOLC_API_KEY */
function resolveArkVisionApiKey() {
  const direct = env("ARK_VISION_API_KEY");
  if (direct) return { apiKey: direct, keySource: "ARK_VISION_API_KEY" };
  const ark = env("ARK_API_KEY");
  if (ark) return { apiKey: ark, keySource: "ARK_API_KEY" };
  const volc = env("VOLC_API_KEY");
  if (volc) return { apiKey: volc, keySource: "VOLC_API_KEY" };
  return null;
}

/** @returns {{ provider: string, apiKey: string, baseURL: string, model: string, keySource: string } | null} */
export function resolveArkVisionConfig() {
  const keyInfo = resolveArkVisionApiKey();
  if (!keyInfo) return null;
  return {
    provider: "ark",
    apiKey: keyInfo.apiKey,
    keySource: keyInfo.keySource,
    baseURL: (env("ARK_VISION_BASE_URL") || env("ARK_BASE_URL") || ARK_DEFAULT_BASE).replace(
      /\/$/,
      "",
    ),
    model: env("ARK_VISION_MODEL") || ARK_VISION_MODEL_DEFAULT,
  };
}

/** Hero / Agent 默认对话路由（与 chat-provider-routing 保持一致） */
function resolveHeroChatProvider() {
  const forced = env("CHAT_PROVIDER").toLowerCase();
  if (forced === "deepseek" && deepseekConfig()) return "deepseek";
  if (forced === "ark" && resolveArkConfig()) return "ark";

  const hasDeepseek = Boolean(deepseekConfig());
  const hasArk = Boolean(resolveArkConfig());
  if (!hasDeepseek && !hasArk) return null;
  if (hasDeepseek && !hasArk) return "deepseek";
  if (hasArk && !hasDeepseek) return "ark";
  return "deepseek";
}

/** 对话 + 识图双密钥栈（供 API / 启动日志 / UI 强关联展示） */
export function describeAiStack() {
  const heroProvider = resolveHeroChatProvider();
  const chatCfg =
    heroProvider === "deepseek"
      ? deepseekConfig()
      : heroProvider === "ark"
        ? resolveArkConfig()
        : resolveChatConfig();
  const visionCfg = resolveArkVisionConfig();

  const chatEnvKey =
    chatCfg?.provider === "deepseek"
      ? "DEEPSEEK_API_KEY"
      : chatCfg?.provider === "ark"
        ? "ARK_API_KEY"
        : null;

  return {
    chat: {
      role: "chat",
      provider: heroProvider ?? chatCfg?.provider ?? null,
      label: getChatProviderLabel(heroProvider ?? chatCfg?.provider),
      model: chatCfg?.model ?? null,
      configured: Boolean(chatCfg),
      envKey: chatEnvKey,
    },
    vision: {
      role: "vision",
      provider: "ark",
      label: getVisionProviderLabel(),
      model: visionCfg?.model ?? null,
      configured: Boolean(visionCfg),
      envKey: visionCfg?.keySource ?? null,
    },
  };
}

const PROVIDERS = {
  deepseek: deepseekConfig,
  ark: resolveArkConfig,
};

/** @returns {{ provider: string, apiKey: string, baseURL: string, model: string } | null} */
export function resolveChatConfig() {
  const forced = env("CHAT_PROVIDER").toLowerCase();
  if (forced && PROVIDERS[forced]) {
    const cfg = PROVIDERS[forced]();
    if (cfg) return cfg;
    return null;
  }

  return deepseekConfig() || resolveArkConfig();
}

/** @returns {{ id: string, label: string, model: string }[]} */
export function listAvailableChatModels() {
  const models = [];
  for (const fn of Object.values(PROVIDERS)) {
    const cfg = fn();
    if (!cfg) continue;
    models.push({
      id: cfg.provider,
      label: getChatProviderLabel(cfg.provider),
      model: cfg.model,
    });
  }
  return models;
}

/** @returns {{ provider: string, apiKey: string, baseURL: string, model: string } | null} */
export function resolveChatConfigByProvider(provider) {
  const id = String(provider ?? "").trim().toLowerCase();
  if (id && PROVIDERS[id]) {
    const cfg = PROVIDERS[id]();
    if (cfg) return cfg;
  }
  return resolveChatConfig();
}

export function getChatProviderLabel(provider) {
  if (provider === "ark") return "火山方舟";
  if (provider === "deepseek") return "DeepSeek";
  return provider || "AI";
}

export function getVisionProviderLabel() {
  return "火山方舟";
}
