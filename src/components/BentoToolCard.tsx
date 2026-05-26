"use client";

import Link from "next/link";
import ToolDemoVisual from "@/components/home/ToolDemoVisual";
import { bentoClass, type Tool } from "@/lib/tools";

type Props = {
  tool: Tool;
  index?: number;
};

export default function BentoToolCard({ tool, index = 0 }: Props) {
  const isHero = tool.bento === "hero";
  const isLarge = isHero || tool.bento === "tall";

  return (
    <Link
      href={tool.href}
      className={`bento-card group block h-full bento-grid-enter ${bentoClass[tool.bento]}`}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <article className="relative flex h-full min-h-[200px] flex-col p-5 sm:p-6">
        <div
          className={`pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br ${tool.gradient} opacity-50 blur-3xl transition-opacity duration-500 group-hover:opacity-80`}
        />

        <div className="relative flex items-start justify-between gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06] text-xl ring-1 ring-white/10 backdrop-blur-md transition-all duration-300 group-hover:bg-white/10 group-hover:ring-blue-400/30">
            {tool.icon}
          </span>
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-medium tracking-wide text-white/45 ring-1 ring-white/10">
            {tool.tag}
          </span>
        </div>

        <div className="relative mt-4 flex-1 flex flex-col">
          <h3
            className={`font-semibold tracking-tight text-white transition-colors group-hover:text-blue-100 ${isHero ? "text-2xl sm:text-3xl" : "text-lg"}`}
          >
            {tool.title}
          </h3>
          <p
            className={`mt-2 text-white/40 leading-relaxed ${isHero ? "text-sm max-w-sm" : "text-xs sm:text-sm line-clamp-2"}`}
          >
            {tool.description}
          </p>

          <div className="mt-4 flex-1 min-h-0">
            <ToolDemoVisual toolId={tool.id} large={isLarge} />
          </div>

          <p className="mt-3 text-[10px] text-white/25 truncate">{tool.demoHint}</p>

          <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4">
            <span className="text-sm font-medium text-blue-300/70 group-hover:text-blue-200 transition-colors">
              打开工具
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/50 transition-all group-hover:bg-blue-500/20 group-hover:text-white group-hover:translate-x-0.5">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
