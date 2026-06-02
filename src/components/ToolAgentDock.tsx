"use client";

import AiChatPanel from "@/components/tools/AiChatPanel";
import { readStoredChatMode, writeStoredChatMode, type ChatMode } from "@/lib/chat";
import { useEffect, useState } from "react";

const HIDDEN_TOOL_IDS = new Set(["ai-chat"]);

type ToolAgentDockProps = {
  toolId: string;
};

export default function ToolAgentDock({ toolId }: ToolAgentDockProps) {
  const [open, setOpen] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>(() => readStoredChatMode());

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (HIDDEN_TOOL_IDS.has(toolId)) return null;

  const handleModeChange = (mode: ChatMode) => {
    setChatMode(mode);
    writeStoredChatMode(mode);
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="打开 Agent 助手"
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-violet-500/30 bg-[#12131f]/95 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-950/40 backdrop-blur-md transition-all hover:border-violet-400/45 hover:bg-violet-500/15"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/25 text-xs text-violet-200">
            ✦
          </span>
          Agent
          {chatMode === "agent" && (
            <span className="rounded-full bg-violet-500/30 px-1.5 py-0.5 text-[10px] text-violet-200">
              已开启
            </span>
          )}
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-40 w-[min(calc(100vw-2rem),420px)] overflow-hidden rounded-2xl border border-white/10 bg-[#0a0b14]/95 shadow-2xl shadow-black/50 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-white/50">Agent 助手</span>
              <div className="flex rounded-lg border border-white/10 bg-black/30 p-0.5">
                <button
                  type="button"
                  onClick={() => handleModeChange("chat")}
                  className={`rounded-md px-2 py-0.5 text-[10px] transition-colors ${
                    chatMode === "chat"
                      ? "bg-violet-500/25 text-white"
                      : "text-white/45 hover:text-white/70"
                  }`}
                >
                  对话
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("agent")}
                  className={`rounded-md px-2 py-0.5 text-[10px] transition-colors ${
                    chatMode === "agent"
                      ? "bg-violet-500/25 text-white"
                      : "text-white/45 hover:text-white/70"
                  }`}
                >
                  Agent
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/tools/ai-chat"
                className="text-[10px] text-white/35 hover:text-white/55"
              >
                全屏
              </a>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-xs text-white/35 hover:bg-white/5 hover:text-white/60"
                aria-label="关闭 Agent 助手"
              >
                收起
              </button>
            </div>
          </div>
          <div className="p-3">
            <AiChatPanel variant="dock" chatMode={chatMode} onChatModeChange={handleModeChange} />
          </div>
        </div>
      )}
    </>
  );
}
