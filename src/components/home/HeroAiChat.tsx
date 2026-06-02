"use client";

import AiChatPanel from "@/components/tools/AiChatPanel";
import { useEffect, useRef, useState } from "react";

export default function HeroAiChat() {
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  if (!expanded) {
    return (
      <div id="ai-chat" className="reveal reveal-d3 mx-auto mt-10 w-full max-w-xl">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="hero-ai-bar group flex w-full items-center gap-3 px-5 py-3.5 text-left transition-all duration-300 hover:border-white/[0.14] hover:bg-white/[0.05] active:scale-[0.995]"
          aria-expanded={false}
          aria-label="展开 AI 对话"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-sm text-white/70 ring-1 ring-white/[0.08] transition-colors group-hover:ring-violet-400/20">
            ✦
          </span>
          <span className="flex-1 text-sm text-white/35 transition-colors group-hover:text-white/45">
            随便聊点什么，或切换到 Agent 模式让我帮你操作工具…
          </span>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/40 ring-1 ring-white/[0.08] transition-all group-hover:bg-white/[0.09] group-hover:text-white/60">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      id="ai-chat"
      ref={panelRef}
      className="reveal reveal-d3 mx-auto mt-10 w-full max-w-2xl"
    >
      <div className="hero-ai-panel">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3 sm:px-5">
          <span className="text-xs font-medium tracking-wide text-white/40">AI 对话</span>
          <div className="flex items-center gap-3">
            <a
              href="/tools/ai-chat"
              className="text-xs text-white/35 transition-colors hover:text-white/55"
            >
              全屏
            </a>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="rounded-lg px-2.5 py-1 text-xs text-white/35 transition-colors hover:bg-white/[0.05] hover:text-white/60"
              aria-label="收起对话"
            >
              收起
            </button>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <AiChatPanel variant="hero" />
        </div>
      </div>
    </div>
  );
}
