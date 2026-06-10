"use client";

import { ChatAttachIcon, ChatSendIcon } from "@/components/workspace/ChatComposerIcons";
import ChatTypingIndicator from "@/components/workspace/ChatTypingIndicator";
import { ChatPendingAttachmentGrid } from "@/components/workspace/ChatMessageMedia";
import WorkspaceDialogToolThread from "@/components/workspace/WorkspaceDialogToolThread";
import { useWorkspaceChat } from "@/contexts/WorkspaceChatContext";
import { useDisplayContent } from "@/hooks/useDisplayContent";
import { pickRandomGreeting } from "@/lib/chat-greetings";
import { CHAT_FILE_ACCEPT } from "@/lib/chat-files";
import { getToolFromPathname } from "@/lib/tool-page";
import { AI_SERVICE_UNAVAILABLE } from "@/lib/service-message";
import { usePathname } from "next/navigation";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

const INPUT_MIN_HEIGHT = 24;
const INPUT_MAX_HEIGHT = 200;

function handleChatEnterKey(
  e: React.KeyboardEvent,
  onSend: () => void,
  composingRef: React.RefObject<boolean>,
) {
  if (e.key !== "Enter" || e.shiftKey) return;
  if (composingRef.current || e.nativeEvent.isComposing || e.keyCode === 229) return;
  e.preventDefault();
  e.stopPropagation();
  onSend();
}

export default function WorkspaceDialogChat() {
  const pathname = usePathname();
  const tool = getToolFromPathname(pathname);
  const isToolRoute = pathname.startsWith("/tools/");

  const {
    caps,
    loading,
    error,
    pendingFiles,
    addFiles,
    removePendingFile,
    sendMessage,
    messages,
  } = useWorkspaceChat();
  const { getToolDialogPlaceholder } = useDisplayContent();

  const [input, setInput] = useState("");
  const [inputPlaceholder] = useState(() => pickRandomGreeting());
  const placeholder = tool
    ? getToolDialogPlaceholder(tool.id, tool.title)
    : inputPlaceholder;
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);

  const pendingAttachments = useMemo(
    () =>
      pendingFiles.map((item) => ({
        id: item.id,
        name: item.file.name,
        kind: item.kind,
        previewUrl: item.previewUrl,
        size: item.file.size,
      })),
    [pendingFiles],
  );

  const syncTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(Math.max(el.scrollHeight, INPUT_MIN_HEIGHT), INPUT_MAX_HEIGHT);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > INPUT_MAX_HEIGHT ? "auto" : "hidden";
  }, []);

  useLayoutEffect(() => {
    syncTextareaHeight();
  }, [input, pendingAttachments.length, syncTextareaHeight]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text && pendingFiles.length === 0) return;
    setInput("");
    await sendMessage(text || "请分析我上传的文件");
    requestAnimationFrame(syncTextareaHeight);
  }, [input, pendingFiles.length, sendMessage, syncTextareaHeight]);

  const canSend =
    (input.trim().length > 0 || pendingFiles.length > 0) && (caps?.available ?? false) && !loading;

  const isExpanded =
    input.length > 0 || pendingAttachments.length > 0 || loading || (isToolRoute && messages.length > 0);

  return (
    <div
      className={`workspace-dialog-panel${isExpanded ? " workspace-dialog-panel-expanded" : ""}`}
      data-expanded={isExpanded ? "true" : undefined}
    >
      {isToolRoute ? <WorkspaceDialogToolThread /> : null}

      <div className="workspace-chat-composer">
        {caps && !caps.available ? (
          <p className="workspace-chat-composer-alert">{AI_SERVICE_UNAVAILABLE}</p>
        ) : null}

        {error ? <p className="workspace-chat-composer-error">{error}</p> : null}

        {pendingAttachments.length > 0 ? (
          <ChatPendingAttachmentGrid items={pendingAttachments} onRemove={removePendingFile} />
        ) : null}

        {loading ? <ChatTypingIndicator compact label="思考中" /> : null}

        <div className="workspace-chat-composer-box">
          <input
            ref={fileRef}
            type="file"
            accept={CHAT_FILE_ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={loading}
            className="workspace-chat-composer-attach"
            title="上传图片、视频、音频、PDF、Word、文本等"
            aria-label="上传附件"
          >
            <ChatAttachIcon />
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              requestAnimationFrame(syncTextareaHeight);
            }}
            onInput={syncTextareaHeight}
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onCompositionEnd={() => {
              composingRef.current = false;
              syncTextareaHeight();
            }}
            onKeyDown={(e) => handleChatEnterKey(e, () => void handleSend(), composingRef)}
            rows={1}
            placeholder={placeholder}
            className="workspace-chat-composer-input"
          />

          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!canSend}
            className="workspace-chat-composer-send"
            aria-label={loading ? "思考中" : "发送"}
          >
            {loading ? (
              <span className="workspace-chat-composer-send-spinner" aria-hidden />
            ) : (
              <ChatSendIcon />
            )}
          </button>
        </div>

        <p className="workspace-chat-composer-hint">
          图片{caps?.attachments.image ? "✓" : "×"} · 音视频{caps?.attachments.audio ? "✓" : "×"} · 文档✓
          <span className="workspace-chat-composer-hint-sep" aria-hidden>
            ·
          </span>
          Enter 发送，Shift + Enter 换行
        </p>
      </div>
    </div>
  );
}
