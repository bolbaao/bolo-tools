"use client";

import ChatBubble, { ChatAgentActionButton } from "@/components/workspace/ChatBubble";
import ChatMessageRow from "@/components/workspace/ChatMessageRow";
import ChatTypingIndicator from "@/components/workspace/ChatTypingIndicator";
import { useWorkspaceChat } from "@/contexts/WorkspaceChatContext";
import { useEffect, useRef } from "react";

/** 工具页底部对话框内的精简对话记录 */
export default function WorkspaceDialogToolThread() {
  const { messages, loading, deleteMessage, openAgentAction } = useWorkspaceChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  if (messages.length === 0 && !loading) return null;

  return (
    <div
      ref={scrollRef}
      className="workspace-dialog-tool-thread custom-scrollbar mb-3 max-h-[min(40vh,280px)] space-y-2.5 overflow-y-auto rounded-xl border border-black/[0.06] bg-black/[0.02] p-3"
    >
      {messages.map((msg) => (
        <ChatMessageRow key={msg.id} messageId={msg.id} onDelete={deleteMessage} compact>
          <ChatBubble msg={msg} variant="compact" />
          {msg.agentAction ? (
            <ChatAgentActionButton
              compact
              title={msg.agentAction.title}
              onClick={() => void openAgentAction(msg.agentAction!, msg.id)}
            />
          ) : null}
        </ChatMessageRow>
      ))}
      {loading ? <ChatTypingIndicator compact label="思考中" /> : null}
    </div>
  );
}
