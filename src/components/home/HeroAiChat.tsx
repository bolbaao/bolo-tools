"use client";

import AiChatPanel from "@/components/tools/AiChatPanel";
import ChatAttachButton from "@/components/chat/ChatAttachButton";
import { pickRandomGreeting } from "@/lib/chat-greetings";
import { useEffect, useRef, useState } from "react";

export default function HeroAiChat() {
  const [expanded, setExpanded] = useState(false);
  const [greeting, setGreeting] = useState(() => pickRandomGreeting("chat"));
  const [incomingFiles, setIncomingFiles] = useState<File[] | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const expandChat = () => setExpanded(true);

  const collapseChat = () => {
    setExpanded(false);
    setGreeting(pickRandomGreeting("chat"));
  };

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") collapseChat();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const openWithFiles = (files: File[]) => {
    if (!files.length) return;
    setIncomingFiles(files);
    expandChat();
  };

  if (!expanded) {
    return (
      <div id="ai-chat" className="reveal reveal-d3 mx-auto mt-10 w-full max-w-xl">
        <div className="hero-ai-bar flex w-full items-center gap-2 px-3 py-2.5 sm:px-4">
          <button
            type="button"
            onClick={expandChat}
            className="group flex min-w-0 flex-1 items-center gap-3 text-left transition-all duration-300 hover:opacity-90 active:scale-[0.995]"
            aria-expanded={false}
            aria-label="展开 AI 对话"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-sm text-white/70 ring-1 ring-white/[0.08] transition-colors group-hover:ring-violet-400/20">
              ✦
            </span>
            <span className="flex-1 truncate text-sm text-white/35 transition-colors group-hover:text-white/45">
              {greeting}
            </span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/40 ring-1 ring-white/[0.08] transition-all group-hover:bg-white/[0.09] group-hover:text-white/60">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </span>
          </button>
          <ChatAttachButton
            onFiles={openWithFiles}
            title="上传图片、PDF 或 Word"
            className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] hover:border-violet-500/35 hover:bg-violet-500/10 transition-colors"
          />
        </div>
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
              onClick={collapseChat}
              className="rounded-lg px-2.5 py-1 text-xs text-white/35 transition-colors hover:bg-white/[0.05] hover:text-white/60"
              aria-label="收起对话"
            >
              收起
            </button>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <AiChatPanel
            variant="hero"
            initialWelcome={greeting}
            incomingFiles={incomingFiles}
            onIncomingFilesConsumed={() => setIncomingFiles(null)}
          />
        </div>
      </div>
    </div>
  );
}
