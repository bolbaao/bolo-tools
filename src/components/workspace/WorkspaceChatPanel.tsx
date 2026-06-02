"use client";

import ChatBubble, { ChatAgentActionButton } from "@/components/workspace/ChatBubble";
import ChatTypingIndicator from "@/components/workspace/ChatTypingIndicator";
import { useWorkspaceChat } from "@/contexts/WorkspaceChatContext";
import { pickRandomGreeting } from "@/lib/chat-greetings";
import { useEffect, useMemo, useRef } from "react";

export default function WorkspaceChatPanel() {
  const { messages, loading, clearMessages, openAgentAction } = useWorkspaceChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const emptyHint = useMemo(() => pickRandomGreeting(), []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: messages.length > 1 ? "smooth" : "auto" });
  }, [messages, loading]);

  return (
    <div className="workspace-chat-panel flex min-h-0 flex-1 flex-col">
      {messages.length > 0 ? (
        <div className="mb-4 flex items-center justify-end">
          <button
            type="button"
            onClick={clearMessages}
            className="text-[11px] text-black/38 transition-colors hover:text-black/62"
          >
            清空对话
          </button>
        </div>
      ) : null}

      <div ref={scrollRef} className="workspace-chat-scroll custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        {messages.length === 0 && !loading ? (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-muted text-lg text-accent-deep/80 ring-1 ring-accent/15">
              ✦
            </div>
            <p className="max-w-md text-sm leading-relaxed text-black/45">{emptyHint}</p>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-2xl space-y-6 pb-6">
            {messages.map((msg) => (
              <div key={msg.id}>
                <ChatBubble msg={msg} />
                {msg.agentAction ? (
                  <ChatAgentActionButton
                    title={msg.agentAction.title}
                    onClick={() => openAgentAction(msg.agentAction!)}
                  />
                ) : null}
              </div>
            ))}
            {loading ? <ChatTypingIndicator label="思考中" /> : null}
          </div>
        )}
      </div>
    </div>
  );
}
