import { env } from "./env.mjs";

const DEEPSEEK_DEFAULT_BASE = "https://api.deepseek.com/v1";
const DEEPSEEK_DEFAULT_MODEL = "deepseek-chat";
const ARK_DEFAULT_BASE = "https://ark.cn-beijing.volces.com/api/v3";
const ARK_DEFAULT_MODEL = "doubao-1-5-pro-32k-250115";

function deepseekConfig() {
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
