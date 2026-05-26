"use client";

import { consumeAgentPrefill } from "@/lib/agent-prefill";
import { useEffect, useRef } from "react";

/** 工具页挂载时消费智能体预填数据 */
export function useAgentPrefill(
  toolId: string,
  apply: (fields: Record<string, string>) => void,
) {
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current) return;
    const fields = consumeAgentPrefill(toolId);
    if (fields) {
      apply(fields);
      applied.current = true;
    }
  }, [toolId, apply]);
}
