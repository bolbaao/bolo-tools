/** 预填后等待 React 状态更新再自动提交 */
export const AGENT_AUTOSUBMIT_DELAY_MS = 250;

export type AgentPrefillPayload = {
  toolId: string;
  fields: Record<string, string>;
  ts: number;
  /** 默认 true：Agent 预填后自动执行主操作 */
  autoSubmit?: boolean;
};

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
    "mode",
    "format",
    "tab",
  ];
  return keys.some((k) => Boolean(fields[k]?.trim()));
}
