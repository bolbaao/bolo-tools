"use client";

type Props = {
  /** 对话框内紧凑样式 */
  compact?: boolean;
  label?: string;
};

export default function ChatTypingIndicator({ compact = false, label }: Props) {
  return (
    <div
      className={`workspace-chat-row workspace-chat-row-assistant${
        compact ? " workspace-dialog-typing-row" : ""
      }`}
      role="status"
      aria-live="polite"
      aria-label={label || "思考中"}
    >
      <div className="workspace-chat-avatar" aria-hidden>
        ✦
      </div>
      <div
        className={`workspace-chat-bubble workspace-chat-bubble-assistant workspace-chat-typing${
          compact ? " workspace-dialog-typing-bubble" : ""
        }${label && !compact ? " workspace-chat-typing-labeled" : ""}`}
      >
        {label ? (
          <span
            className={
              compact ? "workspace-dialog-typing-label" : "workspace-chat-typing-label"
            }
          >
            {label}
          </span>
        ) : null}
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
