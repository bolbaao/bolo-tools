"use client";

import { clearToolPrefillFiles, peekToolPrefillFiles } from "@/lib/tool-prefill-files";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const RETRY_DELAYS_MS = [100, 400, 1000, 2500];

export type UseToolPrefillFilesOptions = {
  onFiles: (files: File[]) => void;
};

/** 工具页挂载时消费跨页传入的文件（IndexedDB） */
export function useToolPrefillFiles(toolId: string, options: UseToolPrefillFilesOptions) {
  const pathname = usePathname();
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const handledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    handledRef.current = false;

    const attempt = async () => {
      if (cancelled || handledRef.current) return;
      const files = await peekToolPrefillFiles(toolId);
      if (!files?.length) return;
      handledRef.current = true;
      optionsRef.current.onFiles(files);
      await clearToolPrefillFiles(toolId);
    };

    void attempt();
    const timers = RETRY_DELAYS_MS.map((ms) => window.setTimeout(() => void attempt(), ms));

    return () => {
      cancelled = true;
      for (const id of timers) window.clearTimeout(id);
    };
  }, [toolId, pathname]);
}
