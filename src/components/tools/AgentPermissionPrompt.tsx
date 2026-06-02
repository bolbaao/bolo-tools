"use client";

import { PERMISSION_META } from "@/lib/agent-permissions";
import type { AgentPermissionRequest } from "@/lib/agent-types";

type AgentPermissionPromptProps = {
  requests: AgentPermissionRequest[];
  busy: boolean;
  onAllow: (type: AgentPermissionRequest["type"]) => void;
  onDeny: (type: AgentPermissionRequest["type"]) => void;
  onAllowAll?: () => void;
};

export default function AgentPermissionPrompt({
  requests,
  busy,
  onAllow,
  onDeny,
  onAllowAll,
}: AgentPermissionPromptProps) {
  if (!requests.length) return null;

  return (
    <div className="max-w-[90%] space-y-2">
      {requests.length > 1 && onAllowAll && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onAllowAll}
            className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs text-amber-200/90 hover:bg-amber-500/15 disabled:opacity-50 transition-colors"
          >
            依次授权全部（{requests.length} 项）
          </button>
        </div>
      )}
      {requests.map((req) => {
        const meta = PERMISSION_META[req.type];
        return (
          <div
            key={req.type}
            className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-3 py-2.5 text-xs text-white/70"
          >
            <p className="font-medium text-amber-200/90 mb-0.5">需要你的授权：{meta.title}</p>
            <p className="text-white/50 mb-2 leading-relaxed">
              {req.reason?.trim() || meta.hint}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => onAllow(req.type)}
                className="rounded-lg bg-amber-500/90 px-3 py-1.5 text-xs font-medium text-[#1a1408] hover:bg-amber-400 disabled:opacity-50 transition-colors"
              >
                {meta.allowLabel ?? "允许"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onDeny(req.type)}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/60 hover:text-white/85 hover:border-white/25 disabled:opacity-50 transition-colors"
              >
                暂不
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
