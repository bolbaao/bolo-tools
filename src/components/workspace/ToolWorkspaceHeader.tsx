"use client";

import { ToolIconBox } from "@/components/icons/ToolIcon";
import { useOptionalWorkspaceChat } from "@/contexts/WorkspaceChatContext";
import type { Tool } from "@/lib/tools";

export default function ToolWorkspaceHeader({ tool }: { tool: Tool }) {
  const chatCtx = useOptionalWorkspaceChat();

  return (
    <div className="space-y-4">
      {chatCtx ? (
        <button
          type="button"
          onClick={chatCtx.backToChat}
          className="group inline-flex items-center gap-1.5 rounded-lg px-1 py-1 -ml-1 text-sm text-black/45 transition-colors hover:text-black/72"
          aria-label="返回对话"
        >
          <svg
            className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回对话
        </button>
      ) : null}
      <div className="flex items-start gap-4">
        <ToolIconBox id={tool.id} size="md" className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight text-[#1d1d1f] sm:text-[1.375rem]">
              {tool.title}
            </h1>
            <span className="rounded-full bg-indigo-500/[0.08] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-700/80 ring-1 ring-indigo-500/15">
              {tool.tag}
            </span>
          </div>
          <p className="mt-1.5 max-w-2xl text-[0.9375rem] leading-relaxed text-black/52">
            {tool.description}
          </p>
        </div>
      </div>
    </div>
  );
}
