import { env } from "./env.mjs";

/** @typedef {{ label: string, baseUrl: string, apiMode: "v2" | "submit" | "auto", model: string, docs: string }} SunoPreset */

/** @type {Record<string, SunoPreset>} */
export const SUNO_PRESETS = {
  gptnb: {
    label: "GPTNB",
    baseUrl: "https://api.gptnb.ai",
    apiMode: "v2",
    model: "chirp-v4",
    docs: "https://docs.gptnb.ai",
  },
  "openai-hk": {
    label: "OpenAI-HK",
    baseUrl: "https://api.openai-hk.com",
    apiMode: "submit",
    model: "chirp-v4",
    docs: "https://www.openai-hk.com/docs/lab/suno-newapi.html",
  },
};

export function listSunoPresets() {
  return Object.entries(SUNO_PRESETS).map(([id, p]) => ({
    id,
    label: p.label,
    baseUrl: p.baseUrl,
    apiMode: p.apiMode,
    docs: p.docs,
  }));
}

export function resolveSunoConfig() {
  const providerId = env("SUNO_PROVIDER").toLowerCase();
  const preset = providerId ? SUNO_PRESETS[providerId] : null;

  const baseURL = (env("SUNO_API_BASE") || preset?.baseUrl || "").replace(/\/$/, "");
  const apiKey = env("SUNO_API_KEY");
  const model = env("SUNO_MODEL") || preset?.model || "chirp-v4";
  const rawMode = env("SUNO_API_MODE").toLowerCase();
  const apiMode = rawMode || preset?.apiMode || "auto";

  return {
    providerId: providerId || null,
    providerLabel: preset?.label || (baseURL && !preset ? "自定义网关" : ""),
    baseURL,
    apiKey,
    model,
    apiMode,
    docs: preset?.docs || "",
    configured: Boolean(baseURL && apiKey),
  };
}
