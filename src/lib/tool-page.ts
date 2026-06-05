import { getToolById, type Tool } from "@/lib/tools";
import { getToolDialogPlaceholder as resolveToolDialogPlaceholder } from "@/lib/site-content";

/** 从路由解析工具 id（如 /tools/video-extract → video-extract） */
export function getToolIdFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/tools\/([^/]+)/);
  return match?.[1] ?? null;
}

export function isToolPathname(pathname: string): boolean {
  return pathname.startsWith("/tools/");
}

export function getToolFromPathname(pathname: string): Tool | undefined {
  const id = getToolIdFromPathname(pathname);
  return id ? getToolById(id) : undefined;
}

/** 工具页底部 AI 输入框占位文案 */
export function getToolDialogPlaceholder(tool: Tool, isAdmin = false): string {
  return resolveToolDialogPlaceholder(tool.id, tool.title, isAdmin);
}
