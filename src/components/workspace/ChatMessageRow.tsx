"use client";

import type { ReactNode } from "react";

type Props = {
  messageId: string;
  onDelete: (id: string) => void;
  compact?: boolean;
  children: ReactNode;
};

function DeleteIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export default function ChatMessageRow({ messageId, onDelete, compact, children }: Props) {
  return (
    <div
      className={`workspace-chat-message-group${compact ? " workspace-chat-message-group-compact" : ""}`}
    >
      <button
        type="button"
        onClick={() => {
          if (!confirm("确定删除这条消息？")) return;
          onDelete(messageId);
        }}
        className="workspace-chat-message-delete"
        title="删除消息"
        aria-label="删除消息"
      >
        <DeleteIcon />
      </button>
      {children}
    </div>
  );
}
