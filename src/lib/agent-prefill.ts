const STORAGE_KEY = "pineapple-agent-prefill";

export const AGENT_PREFILL_EVENT = "pineapple-agent:prefill";

/** 预填后等待 React 状态更新再自动提交 */
export const AGENT_AUTOSUBMIT_DELAY_MS = 150;

export type AgentPrefillPayload = {
  toolId: string;
  fields: Record<string, string>;
  ts: number;
  /** 默认 true：Agent 预填后自动执行主操作 */
  autoSubmit?: boolean;
};

export type AgentPrefillEventDetail = {
  toolId: string;
  fields: Record<string, string>;
  autoSubmit?: boolean;
};

export type SaveAgentPrefillOptions = {
  /** 默认 true */
  autoSubmit?: boolean;
  /** 跳转前仅写入 storage，避免旧页面误触发 */
  silent?: boolean;
};

export function saveAgentPrefill(
  toolId: string,
  fields: Record<string, string>,
  options?: SaveAgentPrefillOptions,
) {
  const autoSubmit = options?.autoSubmit !== false;
  const payload: AgentPrefillPayload = { toolId, fields, ts: Date.now(), autoSubmit };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  if (typeof window !== "undefined" && !options?.silent) {
    window.dispatchEvent(
      new CustomEvent<AgentPrefillEventDetail>(AGENT_PREFILL_EVENT, {
        detail: { toolId, fields, autoSubmit },
      }),
    );
  }
}

export function consumeAgentPrefill(toolId: string): AgentPrefillPayload | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as AgentPrefillPayload;
    if (data.toolId !== toolId || Date.now() - data.ts > 120_000) return null;
    sessionStorage.removeItem(STORAGE_KEY);
    return data;
  } catch {
    return null;
  }
}

/** 是否具备可自动提交的正文类字段 */
export function agentPrefillHasActionableFields(fields: Record<string, string>): boolean {
  const keys = [
    "url",
    "query",
    "keyword",
    "input",
    "description",
    "content",
    "script",
    "instruction",
    "prompt",
    "topic",
  ];
  return keys.some((k) => Boolean(fields[k]?.trim()));
}
