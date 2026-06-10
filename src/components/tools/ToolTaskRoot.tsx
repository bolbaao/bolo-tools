"use client";

import { useToolPageFocus } from "@/hooks/useToolPageFocus";
import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  toolId: string;
  children: ReactNode;
  className?: string;
};

/** 工具主任务区：进入页自动聚焦、结果出现时滚入视野 */
export default function ToolTaskRoot({ toolId, children, className = "" }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  useToolPageFocus(toolId);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const panel = root.closest(".workspace-panel");
    panel?.scrollTo({ top: 0, behavior: "auto" });
  }, [toolId]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const scrollToResult = () => {
      const target = root.querySelector("[data-tool-result]");
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };
    const observer = new MutationObserver(() => {
      if (root.querySelector("[data-tool-result]")) scrollToResult();
    });
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-tool-result"] });
    return () => observer.disconnect();
  }, [toolId]);

  return (
    <div ref={rootRef} className={`tool-task-root ${className}`.trim()}>
      <div className="tool-task-main">{children}</div>
    </div>
  );
}
