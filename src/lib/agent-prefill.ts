const STORAGE_KEY = "pineapple-agent-prefill";

export type AgentPrefillPayload = {
  toolId: string;
  fields: Record<string, string>;
  ts: number;
};

export function saveAgentPrefill(toolId: string, fields: Record<string, string>) {
  const payload: AgentPrefillPayload = { toolId, fields, ts: Date.now() };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function consumeAgentPrefill(toolId: string): Record<string, string> | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as AgentPrefillPayload;
    if (data.toolId !== toolId || Date.now() - data.ts > 120_000) return null;
    sessionStorage.removeItem(STORAGE_KEY);
    return data.fields;
  } catch {
    return null;
  }
}
