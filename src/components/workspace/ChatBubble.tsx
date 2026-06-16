"use client";

import {
  ChatAttachmentGrid,
  ChatDownloadFileList,
  ChatReplyImageGallery,
} from "@/components/workspace/ChatMessageMedia";
import ChatLiveInfoCard from "@/components/workspace/ChatLiveInfoCard";
import ChatWeatherCard from "@/components/workspace/ChatWeatherCard";
import type { ChatMessage } from "@/contexts/WorkspaceChatContext";
import { extractChatReplyMedia, stripChatAttachmentNote } from "@/lib/chat-files";
import { markdownToHtml } from "@/lib/text-tools";
import { useMemo } from "react";

type Props = {
  msg: ChatMessage;
  variant?: "panel" | "compact";
};

function AssistantAvatar({ compact }: { compact?: boolean }) {
  return (
    <div
      className={`workspace-chat-avatar${compact ? " workspace-chat-avatar-compact" : ""}`}
      aria-hidden
    >
      ✦
    </div>
  );
}

export default function ChatBubble({ msg, variant = "panel" }: Props) {
  const compact = variant === "compact";

  const displayContent = useMemo(
    () => (msg.role === "user" ? stripChatAttachmentNote(msg.content) : msg.content),
    [msg.content, msg.role],
  );

  const assistantParts = useMemo(() => {
    if (msg.role !== "assistant") return null;
    return extractChatReplyMedia(displayContent);
  }, [displayContent, msg.role]);

  const html = useMemo(() => {
    if (msg.role !== "assistant") return null;
    const text = assistantParts?.text || displayContent;
    return text ? markdownToHtml(text) : "";
  }, [assistantParts?.text, displayContent, msg.role]);

  if (msg.role === "user") {
    if (compact) {
      return (
        <div className="workspace-chat-bubble-compact-user">
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
      <div className="workspace-chat-turn-content workspace-chat-turn-content-user">
        <div className="workspace-chat-bubble workspace-chat-bubble-user">
          {msg.attachments?.length ? <ChatAttachmentGrid items={msg.attachments} /> : null}
          {displayContent ? (
            <p className="whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed">{displayContent}</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="workspace-chat-turn-content workspace-chat-turn-content-assistant">
        <AssistantAvatar compact />
        <div className="workspace-chat-assistant-body workspace-chat-assistant-body-compact">
          {html ? (
            <div
              className="workspace-chat-markdown workspace-chat-markdown-compact"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : null}
          {assistantParts?.images.length ? (
            <ChatReplyImageGallery items={assistantParts.images} />
          ) : null}
          {assistantParts?.weather ? (
            <ChatWeatherCard card={assistantParts.weather} compact />
          ) : null}
          {assistantParts?.liveInfo ? (
            <ChatLiveInfoCard card={assistantParts.liveInfo} compact />
          ) : null}
          {assistantParts?.downloads.length ? (
            <ChatDownloadFileList items={assistantParts.downloads} />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-chat-turn-content workspace-chat-turn-content-assistant">
      <AssistantAvatar />
      <div className="workspace-chat-assistant-body">
        {html ? (
          <div
            className="workspace-chat-markdown text-[0.9375rem] leading-[1.7]"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : null}
        {assistantParts?.images.length ? (
          <ChatReplyImageGallery items={assistantParts.images} />
        ) : null}
        {assistantParts?.weather ? <ChatWeatherCard card={assistantParts.weather} /> : null}
        {assistantParts?.liveInfo ? <ChatLiveInfoCard card={assistantParts.liveInfo} /> : null}
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
  loading,
}: {
  title: string;
  compact?: boolean;
  onClick: () => void;
  loading?: boolean;
}) {
  const label = loading ? "处理中…" : `继续处理 · ${title}`;

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="workspace-chat-agent-action workspace-chat-agent-action-compact"
      >
        {label}
      </button>
    );
  }

  return (
    <div className="workspace-chat-agent-action-row">
      <div className="workspace-chat-avatar invisible" aria-hidden />
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="workspace-chat-agent-action"
      >
        {label}
      </button>
    </div>
  );
}
