import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { dispatchAgentPrefillEvent, saveAgentPrefill } from "@/lib/agent-prefill";
import { buildAgentPrefillHref, prefillTargetPath } from "@/lib/agent-prefill-href";
import type { ActionResult, AgentAction } from "@/lib/agent-types";
import { openToolkit } from "@/lib/toolkit";
import { getToolById } from "@/lib/tools";

export const AGENT_UI_EVENT = "pineapple-agent:ui";

/** prefill 先于 navigate，且跳过与 prefill 重复的 navigate */
function orderAgentActions(actions: AgentAction[]): AgentAction[] {
  const prefills = actions.filter((a) => a.type === "prefill");
  const prefillPaths = new Set(
    prefills.map((a) => prefillTargetPath(String(a.params?.toolId ?? ""))),
  );

  const rest = actions.filter((a) => {
    if (a.type === "prefill") return false;
    if (a.type === "navigate") {
      const path = String(a.params?.path ?? "").replace(/\/$/, "");
      for (const target of prefillPaths) {
        if (path === target.replace(/\/$/, "")) return false;
      }
    }
    return true;
  });

  return [...prefills, ...rest];
}

export async function executeAgentActions(
  actions: AgentAction[],
  router: AppRouterInstance,
): Promise<ActionResult[]> {
  const results: ActionResult[] = [];

  for (const action of orderAgentActions(actions)) {
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
      const href = buildAgentPrefillHref(toolId, fields);
      saveAgentPrefill(toolId, fields, { autoSubmit: true, silent: true });

      const onTargetPage =
        typeof window !== "undefined" &&
        window.location.pathname.replace(/\/$/, "") ===
          prefillTargetPath(toolId).replace(/\/$/, "");

      if (typeof window !== "undefined" && !onTargetPage) {
        // 静态导出站点：整页跳转 + URL 参数，比 router.push 更可靠
        window.location.assign(href);
      } else {
        router.push(href);
        window.setTimeout(() => {
          dispatchAgentPrefillEvent({ toolId, fields, autoSubmit: true });
        }, 80);
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
