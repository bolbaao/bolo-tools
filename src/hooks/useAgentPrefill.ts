"use client";

import {
  AGENT_AUTOSUBMIT_DELAY_MS,
  agentPrefillHasActionableFields,
  consumeUrlPrefill,
  type AgentPrefillPayload,
} from "@/lib/agent-prefill";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export type UseAgentPrefillOptions = {
  apply: (fields: Record<string, string>) => void;
  /** 预填完成后自动执行（如解析、搜索、生成） */
  submit?: (fields: Record<string, string>) => void | Promise<void>;
  canSubmit?: (fields: Record<string, string>) => boolean;
};

const RETRY_DELAYS_MS = [100, 400, 1000, 2500];

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

function handlePayload(
  options: UseAgentPrefillOptions,
  payload: AgentPrefillPayload,
  handledTsRef: React.MutableRefObject<number>,
) {
  if (payload.ts <= handledTsRef.current) return false;
  handledTsRef.current = payload.ts;
  runPrefill(options, payload.fields, payload.autoSubmit !== false);
  return true;
}

/** 工具页挂载时消费 URL 中的智能体预填，并在 Agent 模式下自动执行主操作 */
export function useAgentPrefill(toolId: string, options: UseAgentPrefillOptions) {
  const pathname = usePathname();
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const handledTsRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const attempt = () => {
      if (cancelled) return;
      const payload = consumeUrlPrefill(toolId);
      if (!payload) return;
      handlePayload(optionsRef.current, payload, handledTsRef);
    };

    attempt();
    const timers = RETRY_DELAYS_MS.map((ms) => window.setTimeout(attempt, ms));

    return () => {
      cancelled = true;
      for (const id of timers) window.clearTimeout(id);
    };
  }, [toolId, pathname]);
}
