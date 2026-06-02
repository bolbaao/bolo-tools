"use client";

import { useEffect } from "react";

const PRIMARY_SELECTOR =
  '[data-tool-primary-input], input[type="url"], input[type="search"], input[type="text"]:not([readonly]), textarea:not([readonly])';

/** 进入工具页后聚焦主输入，跳过隐藏与文件选择框 */
export function useToolPageFocus(toolId: string, rootSelector = ".tool-workspace .workspace-body") {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const root = document.querySelector(rootSelector);
      if (!root) return;
      const candidates = root.querySelectorAll<HTMLElement>(PRIMARY_SELECTOR);
      for (const el of candidates) {
        if (el.offsetParent === null) continue;
        if (el instanceof HTMLInputElement && el.type === "file") continue;
        if (el instanceof HTMLInputElement && el.disabled) continue;
        if (el instanceof HTMLTextAreaElement && el.disabled) continue;
        el.focus({ preventScroll: true });
        return;
      }
    }, 80);
    return () => window.clearTimeout(timer);
  }, [toolId, rootSelector]);
}
