"use client";

import { ToolIconBox } from "@/components/icons/ToolIcon";
import type { Tool } from "@/lib/tools";
import Link from "next/link";

type Props = {
  tool: Tool;
  description?: string;
  variant?: "dark" | "light";
  compact?: boolean;
  /** 首屏预览：不可点击（全屏进入层会拦截） */
  preview?: boolean;
};

export default function FeaturedToolCard({
  tool,
  description,
  variant = "light",
  compact = false,
  preview = false,
}: Props) {
  const cardClass =
    variant === "dark" ? "featured-tool-card" : "featured-tool-card featured-tool-card-light";
  const summary = description ?? tool.description;

  const inner = (
    <div className="flex items-start gap-3.5">
      <ToolIconBox id={tool.id} size={compact ? "sm" : "md"} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3
            className={`truncate font-semibold tracking-tight ${
              variant === "dark" ? "text-white/92" : "text-[#1d1d1f]"
            } ${compact ? "text-sm" : "text-[0.9375rem]"}`}
          >
            {tool.title}
          </h3>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
              variant === "dark"
                ? "bg-white/[0.06] text-white/45 ring-1 ring-white/[0.08]"
                : "bg-indigo-500/[0.08] text-indigo-700/75 ring-1 ring-indigo-500/12"
            }`}
          >
            {tool.tag}
          </span>
        </div>
        <p
          className={`mt-1.5 line-clamp-2 leading-relaxed ${
            variant === "dark" ? "text-sm text-white/50" : "text-[13px] text-black/48"
          }`}
        >
          {summary}
        </p>
      </div>
    </div>
  );

  if (preview) {
    return (
      <div className={`${cardClass} block ${compact ? "p-4" : "p-5 sm:p-6"} pointer-events-none opacity-90`}>
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={tool.href}
      scroll={false}
      className={`${cardClass} group block ${compact ? "p-4" : "p-5 sm:p-6"}`}
    >
      {inner}
    </Link>
  );
}
