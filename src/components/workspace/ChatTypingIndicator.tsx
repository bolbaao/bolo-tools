"use client";

type Props = {
  /** 对话框内紧凑样式 */
  compact?: boolean;
  label?: string;
};

export default function ChatTypingIndicator({ compact = false, label }: Props) {
  if (compact) {
    return (
      <div className="workspace-chat-turn workspace-chat-turn-assistant workspace-chat-turn-compact">
        <div className="workspace-chat-turn-inner">
          <div className="workspace-chat-turn-content workspace-chat-turn-content-assistant">
            <div className="workspace-chat-avatar workspace-chat-avatar-compact" aria-hidden>
              ✦
            </div>
            <div
              className="workspace-chat-typing workspace-chat-typing-compact"
              role="status"
              aria-live="polite"
              aria-label={label || "思考中"}
            >
              {label ? <span className="workspace-chat-typing-label">{label}</span> : null}
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-chat-turn workspace-chat-turn-assistant">
      <div className="workspace-chat-turn-inner">
        <div className="workspace-chat-turn-content workspace-chat-turn-content-assistant">
          <div className="workspace-chat-avatar" aria-hidden>
            ✦
          </div>
          <div
            className={`workspace-chat-typing${label ? " workspace-chat-typing-labeled" : ""}`}
            role="status"
            aria-live="polite"
            aria-label={label || "思考中"}
          >
            {label ? <span className="workspace-chat-typing-label">{label}</span> : null}
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
    </div>
  );
}
