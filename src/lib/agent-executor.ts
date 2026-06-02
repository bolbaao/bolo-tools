import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { saveAgentPrefill } from "@/lib/agent-prefill";
import type { ActionResult, AgentAction } from "@/lib/agent-types";
import { openToolkit } from "@/lib/toolkit";
import { getToolById } from "@/lib/tools";

export const AGENT_UI_EVENT = "pineapple-agent:ui";

export async function executeAgentActions(
  actions: AgentAction[],
  router: AppRouterInstance,
): Promise<ActionResult[]> {
  const results: ActionResult[] = [];

  for (const action of actions) {
    try {
      const r = await runOne(action, router);
      results.push(r);
    } catch (e) {
      results.push({
        type: action.type,
        ok: false,
        message: e instanceof Error ? e.message : "执行失败",
      });
    }
  }

  return results;
}

async function runOne(action: AgentAction, router: AppRouterInstance): Promise<ActionResult> {
  const p = action.params ?? {};

  switch (action.type) {
    case "navigate": {
      const path = String(p.path ?? "");
      if (!path.startsWith("/")) {
        return { type: action.type, ok: false, message: "无效路径" };
      }
      router.push(path);
      const slug = path.replace(/^\/tools\//, "").replace(/\/$/, "");
      const tool = getToolById(slug);
      return {
        type: action.type,
        ok: true,
        message: tool ? `已打开「${tool.title}」` : `已跳转 ${path}`,
      };
    }

    case "scroll": {
      const target = String(p.target ?? "tools");
      if (target === "top") {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return { type: action.type, ok: true, message: "已回到页面顶部" };
      }
      if (target === "tools" || target === "toolkit") {
        openToolkit();
        return { type: action.type, ok: true, message: "已打开实用工具箱" };
      }
      const id = target === "chat" ? "ai-chat" : target;
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return { type: action.type, ok: true, message: `已滚动到「${id}」区域` };
    }

    case "filter_tools": {
      const category = String(p.category ?? "");
      openToolkit({ filterCategory: category });
      return { type: action.type, ok: true, message: `已打开工具箱：${category || "全部"}` };
    }

    case "prefill": {
      const toolId = String(p.toolId ?? "");
      const fields = (p.fields as Record<string, string>) ?? {};
      if (!toolId) return { type: action.type, ok: false, message: "缺少 toolId" };
      const tool = getToolById(toolId);
      const targetPath = tool?.href ?? `/tools/${toolId}`;
      const needsNavigate =
        typeof window !== "undefined" && !window.location.pathname.startsWith(targetPath);
      saveAgentPrefill(toolId, fields, { autoSubmit: true, silent: needsNavigate });
      if (needsNavigate) {
        router.push(targetPath);
      }
      return {
        type: action.type,
        ok: true,
        message: tool
          ? `已为「${tool.title}」预填并自动执行`
          : "已写入预填并自动执行",
      };
    }

    default:
      return { type: action.type, ok: false, message: `未知动作: ${action.type}` };
  }
}

export function formatActionResults(results: ActionResult[]): string {
  if (!results.length) return "";
  return results.map((r) => `${r.ok ? "✓" : "✗"} ${r.message}`).join("\n");
}
