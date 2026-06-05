"use client";

import ActionButton from "@/components/ActionButton";
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

const INPUT_MIN_HEIGHT = 44;
const INPUT_MAX_HEIGHT = 220;

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

  const isExpanded =
    input.length > 0 || pendingAttachments.length > 0 || loading || (isToolRoute && messages.length > 0);

  return (
    <div
      className={`workspace-dialog-panel flex flex-col px-4 py-4 sm:px-6 sm:py-5${
        isExpanded ? " workspace-dialog-panel-expanded" : ""
      }`}
      data-expanded={isExpanded ? "true" : undefined}
    >
      {isToolRoute ? <WorkspaceDialogToolThread /> : null}

      {caps && !caps.available ? (
        <p className="mb-3 text-xs leading-relaxed text-warn/85">{AI_SERVICE_UNAVAILABLE}</p>
      ) : null}

      {error ? (
        <p className="mb-3 rounded-lg border border-red-500/15 bg-red-500/5 px-3 py-2 text-xs text-red-700/90">
          {error}
        </p>
      ) : null}

      {pendingAttachments.length > 0 ? (
        <ChatPendingAttachmentGrid items={pendingAttachments} onRemove={removePendingFile} />
      ) : null}

      {loading ? <ChatTypingIndicator compact label="思考中" /> : null}

      <div className="mt-auto space-y-3">
        <div className="flex flex-wrap items-center gap-2">
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
            className="rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs text-black/55 hover:bg-black/[0.03] disabled:opacity-40"
            title="上传图片、视频、音频、PDF、Word、文本等"
          >
            上传附件
          </button>
          <span className="text-[10px] text-black/32">
            图片{caps?.attachments.image ? "✓" : "×"} · 音视频{caps?.attachments.audio ? "✓" : "×"} · 文档✓
          </span>
        </div>

        <div className="flex gap-2">
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
            className="workspace-dialog-input min-h-[44px] max-h-[220px] flex-1 resize-none overflow-hidden rounded-xl border border-black/10 bg-white px-4 py-3 text-sm leading-relaxed text-black/85 placeholder:text-black/30 focus:border-violet-500/40 focus:outline-none focus:ring-1 focus:ring-violet-500/25"
          />
          <div className="flex shrink-0 flex-col justify-end">
            <ActionButton
              label="发送"
              loadingLabel="思考中…"
              loading={loading}
              disabled={(!input.trim() && pendingFiles.length === 0) || !(caps?.available ?? false)}
              onClick={() => void handleSend()}
              className="!min-w-[72px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
