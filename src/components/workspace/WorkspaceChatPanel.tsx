"use client";

import HomeDiscoverPanel from "@/components/home/HomeDiscoverPanel";
import ChatBubble, { ChatAgentActionButton } from "@/components/workspace/ChatBubble";
import ChatMessageRow from "@/components/workspace/ChatMessageRow";
import ChatTypingIndicator from "@/components/workspace/ChatTypingIndicator";
import { useWorkspaceChat } from "@/contexts/WorkspaceChatContext";
import { useEffect, useRef } from "react";

export default function WorkspaceChatPanel() {
  const { messages, loading, clearMessages, deleteMessage, openAgentAction } = useWorkspaceChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: messages.length > 1 ? "smooth" : "auto" });
  }, [messages, loading]);

  return (
    <div className="workspace-chat-panel flex min-h-0 flex-1 flex-col">
      {messages.length > 0 ? (
        <div className="workspace-chat-toolbar">
          <button
            type="button"
            onClick={() => {
              if (!confirm("确定清空全部对话？")) return;
              clearMessages();
            }}
            className="workspace-chat-clear"
          >
            清空对话
          </button>
        </div>
      ) : null}

      <div ref={scrollRef} className="workspace-chat-scroll custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        {messages.length === 0 && !loading ? (
          <HomeDiscoverPanel />
        ) : (
          <div className="workspace-chat-thread">
            {messages.map((msg) => (
              <ChatMessageRow key={msg.id} messageId={msg.id} role={msg.role} onDelete={deleteMessage}>
                <ChatBubble msg={msg} />
                {msg.agentAction ? (
                  <ChatAgentActionButton
                    title={msg.agentAction.title}
                    onClick={() => void openAgentAction(msg.agentAction!, msg.id)}
                  />
                ) : null}
              </ChatMessageRow>
            ))}
            {loading ? <ChatTypingIndicator label="思考中" /> : null}
          </div>
        )}
      </div>
    </div>
  );
}
