"use client";

import { useMemo, useState } from "react";
import BentoToolCard from "@/components/BentoToolCard";
import { filterToolsByCategory, getGridTools, getToolCategories } from "@/lib/tools";

export default function ToolsSection() {
  const categories = useMemo(() => getToolCategories(), []);
  const [activeId, setActiveId] = useState("all");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(
    () => filterToolsByCategory(activeId),
    [activeId],
  );

  const activeLabel = categories.find((c) => c.id === activeId)?.label ?? "全部";
  const totalCount = getGridTools().length;

  return (
    <section id="tools" className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
      <details
        open={open}
        onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
        className="group reveal reveal-d3"
      >
        <summary className="list-none cursor-pointer select-none [&::-webkit-details-marker]:hidden">
          <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-4 transition-colors hover:bg-white/[0.04] hover:border-white/12">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-400/70">
                Toolkit
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                全部<span className="text-gradient-accent">工具</span>
                <span className="ml-2 text-base font-normal text-white/35 tabular-nums">
                  {totalCount}
                </span>
              </h2>
              <p className="mt-2 text-sm text-white/40 font-light">
                {open
                  ? activeId === "all"
                    ? "点击收起 · Bento 布局一览"
                    : `正在查看：${activeLabel}`
                  : "默认收起 · 点击展开浏览全部工具"}
              </p>
            </div>
            <span
              className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 text-white/50 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
              aria-hidden
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </div>
        </summary>

        <div className="mt-8 space-y-8">
          <div
            className="flex flex-wrap gap-2"
            role="tablist"
            aria-label="工具分类"
          >
            {categories.map((cat) => {
              const active = activeId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveId(cat.id);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 ${
                    active
                      ? "bg-gradient-to-r from-blue-500/25 to-violet-500/25 text-white ring-1 ring-blue-400/30 shadow-lg shadow-blue-500/10"
                      : "bg-white/5 text-white/45 ring-1 ring-white/8 hover:bg-white/8 hover:text-white/70"
                  }`}
                >
                  {cat.label}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] tabular-nums ${
                      active ? "bg-white/15" : "bg-white/5 text-white/35"
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>

          {filtered.length > 0 ? (
            <div
              key={activeId}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-fr"
            >
              {filtered.map((tool, index) => (
                <BentoToolCard key={tool.id} tool={tool} index={index} />
              ))}
            </div>
          ) : (
            <div className="bento-card px-6 py-16 text-center">
              <p className="text-white/50">该分类下暂无工具</p>
              <button
                type="button"
                onClick={() => setActiveId("all")}
                className="mt-4 text-sm text-blue-300 hover:text-blue-200 transition-colors"
              >
                查看全部
              </button>
            </div>
          )}
        </div>
      </details>
    </section>
  );
}
