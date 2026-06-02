"use client";

import WorkspaceChatPanel from "@/components/workspace/WorkspaceChatPanel";
import WorkspaceDialogChat from "@/components/workspace/WorkspaceDialogChat";
import { useOptionalWorkspaceChat } from "@/contexts/WorkspaceChatContext";
import { usePathname } from "next/navigation";

type Props = {
  children?: React.ReactNode;
  header?: React.ReactNode;
  dialog?: React.ReactNode;
  dialogPlaceholder?: string;
  className?: string;
};

export default function WorkspaceFrame({
  children,
  header,
  dialog,
  dialogPlaceholder = "在此输入或选择工具开始…",
  className = "",
}: Props) {
  const chatCtx = useOptionalWorkspaceChat();
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isToolRoute = pathname.startsWith("/tools/");
  const showChat = Boolean(chatCtx && isHome);
  const showToolHeader = header && !showChat;
  const dialogExpanded = chatCtx?.dialogExpanded ?? true;
  const defaultDialog = chatCtx ? <WorkspaceDialogChat /> : null;

  return (
    <div className={`workspace-frame flex min-h-0 flex-1 flex-col ${className}`}>
      <div className="workspace-unified flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="workspace-panel workspace-light custom-scrollbar min-h-0 flex-1 overflow-y-auto">
          <div className="workspace-panel-inner mx-auto flex min-h-full w-full flex-col px-5 py-6 sm:px-8 sm:py-8">
            {showToolHeader ? (
              <header className="workspace-header mb-7 border-b pb-6 sm:mb-8 sm:pb-7">
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
          } ${isHome ? "workspace-dialog-bar-home" : ""}`}
        >
          {dialog ?? defaultDialog ? (
            dialogExpanded ? (
              <div className="relative">
                {isToolRoute && chatCtx ? (
                  <button
                    type="button"
                    onClick={() => chatCtx.setDialogExpanded(false)}
                    className="absolute right-4 top-4 z-10 text-[11px] text-black/38 transition-colors hover:text-black/62 sm:right-6"
                    aria-label="收起对话框"
                  >
                    收起
                  </button>
                ) : null}
                {dialog ?? defaultDialog}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => chatCtx?.setDialogExpanded(true)}
                className="workspace-dialog-collapsed flex w-full items-center gap-3 px-5 py-3.5 text-left sm:px-8"
                aria-label="展开对话"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-muted text-sm text-accent-deep/80 ring-1 ring-accent/15">
                  ✦
                </span>
                <span className="flex-1 text-sm text-black/42">
                  {isToolRoute ? "需要 AI 协助？点击展开对话" : "有问题？点击展开对话"}
                </span>
                <span className="text-xs text-black/30">展开</span>
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
