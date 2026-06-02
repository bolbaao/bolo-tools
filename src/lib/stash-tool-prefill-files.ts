import type { AgentAction } from "@/lib/agent-types";
import { isDocumentChatFile, isImageChatFile } from "@/lib/chat-files";
import { saveToolPrefillFiles, toolPrefillAcceptsFiles } from "@/lib/tool-prefill-files";

function filesForTool(toolId: string, files: File[]): File[] {
  if (toolId === "doc-convert") return files.filter(isDocumentChatFile);
  if (toolId === "image-studio") return files.filter(isImageChatFile);
  return files;
}

/** Agent 跳转工具页前，把对话里待发送的原始文件写入 IndexedDB */
export async function stashFilesForPrefillActions(
  actions: AgentAction[],
  files: File[],
): Promise<void> {
  if (!files.length) return;
  for (const action of actions) {
    if (action.type !== "prefill") continue;
    const toolId = String(action.params?.toolId ?? "");
    if (!toolPrefillAcceptsFiles(toolId)) continue;
    const picked = filesForTool(toolId, files);
    if (!picked.length) continue;
    await saveToolPrefillFiles(toolId, picked);
    return;
  }
}
