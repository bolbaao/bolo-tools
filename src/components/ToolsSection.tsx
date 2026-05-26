"use client";

import { useMemo, useState } from "react";
import BentoToolCard from "@/components/BentoToolCard";
import { filterToolsByCategory, getToolCategories } from "@/lib/tools";

export default function ToolsSection() {
  const categories = useMemo(() => getToolCategories(), []);
  const [activeId, setActiveId] = useState("all");

  const filtered = useMemo(
    () => filterToolsByCategory(activeId),
    [activeId],
  );

  const activeLabel = categories.find((c) => c.id === activeId)?.label ?? "全部";

  return (
    <section id="tools" className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
      <div className="reveal reveal-d3 mb-10 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-400/70">
          Toolkit
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {activeId === "all" ? (
            <>
              全部<span className="text-gradient-accent">工具</span>
            </>
          ) : (
            <>
              {activeLabel}
              <span className="text-gradient-accent">工具</span>
            </>
          )}
        </h2>
        <p className="mt-3 text-base text-white/40 font-light">
          Bento 布局一览 · 悬停预览演示视频 · 点击进入完整功能
        </p>
      </div>

      <div
        className="reveal reveal-d4 mb-8 flex flex-wrap gap-2"
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
              onClick={() => setActiveId(cat.id)}
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
    </section>
  );
}
