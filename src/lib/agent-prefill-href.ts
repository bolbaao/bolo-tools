import { getToolById } from "@/lib/tools";

function prefillTargetPath(toolId: string): string {
  const tool = getToolById(toolId);
  const raw = tool?.href ?? `/tools/${toolId}`;
  return raw.endsWith("/") ? raw : `${raw}/`;
}

/** 带预填参数的跳转 URL（静态站点跨页自动执行靠 query 传递） */
export function buildAgentPrefillHref(toolId: string, fields: Record<string, string>): string {
  const params = new URLSearchParams();
  params.set("agent_tool", toolId);
  params.set("agent_auto", "1");
  for (const [k, v] of Object.entries(fields)) {
    const val = String(v ?? "").trim();
    if (val) params.set(k, val);
  }
  return `${prefillTargetPath(toolId)}?${params.toString()}`;
}

export { prefillTargetPath };
