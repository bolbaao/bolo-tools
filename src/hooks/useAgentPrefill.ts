"use client";

import {
  AGENT_AUTOSUBMIT_DELAY_MS,
  AGENT_PREFILL_EVENT,
  agentPrefillHasActionableFields,
  consumeAgentPrefill,
  type AgentPrefillEventDetail,
} from "@/lib/agent-prefill";
import { useEffect, useRef } from "react";

export type UseAgentPrefillOptions = {
  apply: (fields: Record<string, string>) => void;
  /** 预填完成后自动执行（如解析、搜索、生成） */
  submit?: (fields: Record<string, string>) => void | Promise<void>;
  canSubmit?: (fields: Record<string, string>) => boolean;
};

function runPrefill(
  options: UseAgentPrefillOptions,
  fields: Record<string, string>,
  autoSubmit: boolean,
) {
  options.apply(fields);
  if (autoSubmit === false || !options.submit) return;
  const allowed = options.canSubmit
    ? options.canSubmit(fields)
    : agentPrefillHasActionableFields(fields);
  if (!allowed) return;
  window.setTimeout(() => {
    void options.submit!(fields);
  }, AGENT_AUTOSUBMIT_DELAY_MS);
}

/** 工具页挂载时消费智能体预填，并在 Agent 模式下自动执行主操作 */
export function useAgentPrefill(toolId: string, options: UseAgentPrefillOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const payload = consumeAgentPrefill(toolId);
    if (payload) {
      runPrefill(optionsRef.current, payload.fields, payload.autoSubmit !== false);
    }
  }, [toolId]);

  useEffect(() => {
    const onPrefill = (event: Event) => {
      const detail = (event as CustomEvent<AgentPrefillEventDetail>).detail;
      if (detail?.toolId === toolId) {
        runPrefill(optionsRef.current, detail.fields, detail.autoSubmit !== false);
      }
    };
    window.addEventListener(AGENT_PREFILL_EVENT, onPrefill);
    return () => window.removeEventListener(AGENT_PREFILL_EVENT, onPrefill);
  }, [toolId]);
}
