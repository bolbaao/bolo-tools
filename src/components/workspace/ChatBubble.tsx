"use client";

import {
  ChatAttachmentGrid,
  ChatDownloadFileList,
} from "@/components/workspace/ChatMessageMedia";
import type { ChatMessage } from "@/contexts/WorkspaceChatContext";
import { extractChatArtifactDownloads, stripChatAttachmentNote } from "@/lib/chat-files";
import { markdownToHtml } from "@/lib/text-tools";
import { useMemo } from "react";

type Props = {
  msg: ChatMessage;
  variant?: "panel" | "compact";
};

export default function ChatBubble({ msg, variant = "panel" }: Props) {
  const compact = variant === "compact";

  const displayContent = useMemo(
    () => (msg.role === "user" ? stripChatAttachmentNote(msg.content) : msg.content),
    [msg.content, msg.role],
  );

  const assistantParts = useMemo(() => {
    if (msg.role !== "assistant") return null;
    return extractChatArtifactDownloads(displayContent);
  }, [displayContent, msg.role]);

  const html = useMemo(() => {
    if (msg.role !== "assistant") return null;
    const text = assistantParts?.text || displayContent;
    return text ? markdownToHtml(text) : "";
  }, [assistantParts?.text, displayContent, msg.role]);

  if (msg.role === "user") {
    if (compact) {
      return (
        <div className="rounded-xl bg-black/[0.04] px-3 py-2 text-xs leading-relaxed text-black/72">
          {msg.attachments?.length ? (
            <div className="mb-1.5">
              <ChatAttachmentGrid items={msg.attachments} />
            </div>
          ) : null}
          {displayContent ? <p className="whitespace-pre-wrap break-words">{displayContent}</p> : null}
        </div>
      );
    }

    return (
      <div className="workspace-chat-row workspace-chat-row-user">
        <div className="workspace-chat-bubble workspace-chat-bubble-user">
          {msg.attachments?.length ? <ChatAttachmentGrid items={msg.attachments} /> : null}
          {displayContent ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{displayContent}</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {html ? (
          <div
            className="workspace-chat-markdown rounded-xl border border-black/[0.06] bg-white px-3 py-2 text-xs leading-relaxed text-black/72"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : null}
        {assistantParts?.downloads.length ? (
          <ChatDownloadFileList items={assistantParts.downloads} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="workspace-chat-row workspace-chat-row-assistant">
      <div className="workspace-chat-avatar" aria-hidden>
        ✦
      </div>
      <div className="workspace-chat-assistant-body">
        {html ? (
          <div
            className="workspace-chat-bubble workspace-chat-bubble-assistant workspace-chat-markdown text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : null}
        {assistantParts?.downloads.length ? (
          <ChatDownloadFileList items={assistantParts.downloads} />
        ) : null}
      </div>
    </div>
  );
}

export function ChatAgentActionButton({
  title,
  compact,
  onClick,
}: {
  title: string;
  compact?: boolean;
  onClick: () => void;
}) {
  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="mt-2 rounded-lg border border-accent/20 bg-accent-muted px-2.5 py-1.5 text-[11px] text-accent-deep/90 transition-colors hover:bg-accent/12"
      >
        打开 {title}
      </button>
    );
  }

  return (
    <div className="workspace-chat-row workspace-chat-row-assistant mt-3">
      <div className="workspace-chat-avatar invisible" aria-hidden />
      <button
        type="button"
        onClick={onClick}
        className="rounded-xl border border-accent/20 bg-accent-muted px-3.5 py-2 text-xs text-accent-deep/90 transition-colors hover:bg-accent/12"
      >
        打开 {title} 并预填
      </button>
    </div>
  );
}
