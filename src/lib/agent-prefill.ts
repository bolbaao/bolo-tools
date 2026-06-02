const STORAGE_KEY = "pineapple-agent-prefill";

export const AGENT_PREFILL_EVENT = "pineapple-agent:prefill";

/** 预填后等待 React 状态更新再自动提交 */
export const AGENT_AUTOSUBMIT_DELAY_MS = 250;

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

function stripAgentPrefillQuery() {
  try {
    window.history.replaceState(window.history.state, "", window.location.pathname);
  } catch {
    /* ignore */
  }
}

/** 从 URL 查询参数读取 Agent 预填（静态导出跨页最可靠） */
export function consumeUrlPrefill(toolId: string): AgentPrefillPayload | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get("agent_tool") !== toolId || params.get("agent_auto") !== "1") return null;

  const fields: Record<string, string> = {};
  params.forEach((value, key) => {
    if (key !== "agent_tool" && key !== "agent_auto") fields[key] = value;
  });
  if (!agentPrefillHasActionableFields(fields)) return null;

  stripAgentPrefillQuery();
  return { toolId, fields, ts: Date.now(), autoSubmit: true };
}

function readAgentPrefill(toolId: string, remove: boolean): AgentPrefillPayload | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as AgentPrefillPayload;
    if (data.toolId !== toolId || Date.now() - data.ts > 120_000) return null;
    if (remove) sessionStorage.removeItem(STORAGE_KEY);
    return data;
  } catch {
    return null;
  }
}

/** 读取预填数据但不删除（用于重试 / Strict Mode 二次挂载） */
export function peekAgentPrefill(toolId: string): AgentPrefillPayload | null {
  return readAgentPrefill(toolId, false);
}

export function consumeAgentPrefill(toolId: string): AgentPrefillPayload | null {
  return readAgentPrefill(toolId, true);
}

export function clearAgentPrefill() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** 同页预填：等 React 更新后再派发，避免 navigate 重渲染时丢事件 */
export function dispatchAgentPrefillEvent(detail: AgentPrefillEventDetail) {
  if (typeof window === "undefined") return;
  const fire = () => {
    window.dispatchEvent(
      new CustomEvent<AgentPrefillEventDetail>(AGENT_PREFILL_EVENT, { detail }),
    );
  };
  if (typeof queueMicrotask === "function") {
    queueMicrotask(fire);
  } else {
    window.setTimeout(fire, 0);
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
