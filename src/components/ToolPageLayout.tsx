"use client";

import ToolTaskRoot from "@/components/tools/ToolTaskRoot";
import ToolWorkspaceHeader from "@/components/workspace/ToolWorkspaceHeader";
import WorkspaceFrame from "@/components/workspace/WorkspaceFrame";
import { useOptionalWorkspaceChat } from "@/contexts/WorkspaceChatContext";
import { useDisplayContent } from "@/hooks/useDisplayContent";
import type { Tool } from "@/lib/tools";

type Props = {
  tool: Tool;
  children: React.ReactNode;
  workspace?: React.ReactNode;
  dialogPlaceholder?: string;
};

export default function ToolPageLayout({ tool, children, workspace, dialogPlaceholder }: Props) {
  const { getToolDialogPlaceholder } = useDisplayContent();
  const chatCtx = useOptionalWorkspaceChat();
  const taskContent = workspace ?? <ToolTaskRoot toolId={tool.id}>{children}</ToolTaskRoot>;
  const exiting = chatCtx?.toolPageExiting ?? false;

  return (
    <div
      className={`tool-workspace flex h-full min-h-0 flex-col overflow-hidden${exiting ? " tool-workspace-exiting" : ""}`}
      data-tool-id={tool.id}
      data-tool-tag={tool.tag}
    >
      <WorkspaceFrame
        variant="tool"
        header={<ToolWorkspaceHeader tool={tool} />}
        dialogPlaceholder={dialogPlaceholder ?? getToolDialogPlaceholder(tool.id, tool.title)}
      >
        {taskContent}
      </WorkspaceFrame>
    </div>
  );
}
