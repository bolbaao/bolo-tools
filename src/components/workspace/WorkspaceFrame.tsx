"use client";

import WorkspaceChatPanel from "@/components/workspace/WorkspaceChatPanel";
import WorkspaceDialogChat from "@/components/workspace/WorkspaceDialogChat";
import { useOptionalWorkspaceChat } from "@/contexts/WorkspaceChatContext";
import { pickRandomGreeting } from "@/lib/chat-greetings";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

type Props = {
  children?: React.ReactNode;
  header?: React.ReactNode;
  dialog?: React.ReactNode;
  dialogPlaceholder?: string;
  className?: string;
  variant?: "default" | "tool";
};

export default function WorkspaceFrame({
  children,
  header,
  dialog,
  dialogPlaceholder = "在此输入或选择工具开始…",
  className = "",
  variant = "default",
}: Props) {
  const chatCtx = useOptionalWorkspaceChat();
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isToolRoute = pathname.startsWith("/tools/");
  const homeGreeting = useMemo(() => pickRandomGreeting(), []);
  const showChat = Boolean(chatCtx && isHome);
  const showToolHeader = header && !showChat;
  const dialogExpanded = chatCtx?.dialogExpanded ?? true;
  const defaultDialog = chatCtx ? <WorkspaceDialogChat /> : null;

  const isToolFrame = variant === "tool" || isToolRoute;

  return (
    <div
      className={`workspace-frame flex min-h-0 flex-1 flex-col ${isToolFrame ? "workspace-frame--tool" : ""} ${className}`}
    >
      <div className={`workspace-unified flex min-h-0 flex-1 flex-col overflow-hidden ${isToolFrame ? "workspace-unified--tool" : ""}`}>
        <div className="workspace-panel workspace-light custom-scrollbar min-h-0 flex-1 overflow-y-auto">
          <div className={`workspace-panel-inner mx-auto flex min-h-full w-full flex-col ${isToolFrame ? "workspace-panel-inner--tool" : "px-4 py-5 sm:px-8 sm:py-8"}`}>
            {showToolHeader ? (
              <header className={`workspace-header ${isToolFrame ? "workspace-header--tool" : "mb-7 border-b pb-6 sm:mb-8 sm:pb-7"}`}>
                {header}
              </header>
            ) : null}
            <div className="workspace-body flex min-h-0 flex-1 flex-col">
              {showChat ? <WorkspaceChatPanel /> : (children ?? null)}
            </div>
          </div>
        </div>
        <div
          className={`workspace-dialog-bar shrink-0 ${
            dialogExpanded ? "" : "workspace-dialog-bar-collapsed"
          } ${isHome ? "workspace-dialog-bar-home" : ""} ${isToolFrame ? "workspace-dialog-bar--tool" : ""}`}
        >
          {dialog ?? defaultDialog ? (
            dialogExpanded ? (
              <div className="relative">
                {isToolRoute && chatCtx ? (
                  <button
                    type="button"
                    onClick={() => chatCtx.setDialogExpanded(false)}
                    className="tool-dialog-collapse absolute right-4 top-3.5 z-10 sm:right-6"
                    aria-label="收起对话框"
                  >
                    <span className="tool-dialog-collapse-icon" aria-hidden>
                      ▾
                    </span>
                    收起助手
                  </button>
                ) : null}
                {dialog ?? defaultDialog}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => chatCtx?.setDialogExpanded(true)}
                className={`workspace-dialog-collapsed ${isToolFrame ? "workspace-dialog-collapsed--tool" : ""}`}
                aria-label="展开对话"
              >
                <span className="workspace-dialog-collapsed-icon" aria-hidden>
                  ✦
                </span>
                <span className="workspace-dialog-collapsed-text">
                  <span className="workspace-dialog-collapsed-title">
                    {isToolRoute ? "需要 AI 协助？" : homeGreeting}
                  </span>
                  <span className="workspace-dialog-collapsed-desc">
                    {isToolRoute ? "随时向我提问，我会尽力为你解答" : "点击展开，开始对话"}
                  </span>
                </span>
                <span className="workspace-dialog-collapsed-cta">
                  {isToolRoute ? "展开对话" : "展开"}
                </span>
              </button>
            )
          ) : (
            <div className="workspace-dialog flex items-center px-5 py-3.5 sm:px-8">
              <span className="text-sm text-black/38">{dialogPlaceholder}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
