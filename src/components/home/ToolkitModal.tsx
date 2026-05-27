"use client";

import BentoToolCard from "@/components/BentoToolCard";
import { TOOLKIT_OPEN_EVENT, type ToolkitOpenDetail } from "@/lib/toolkit";
import { filterToolsByCategory, getToolCategories, getToolkitTools } from "@/lib/tools";
import { useEffect, useMemo, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  initialCategory?: string;
};

function resolveCategoryId(categories: ReturnType<typeof getToolCategories>, category?: string) {
  if (!category || category === "全部") return "all";
  const match = categories.find((c) => c.label === category || c.id === category);
  return match?.id ?? "all";
}

export default function ToolkitModal({ open, onClose, initialCategory }: Props) {
  const categories = useMemo(() => getToolCategories(), []);
  const [activeId, setActiveId] = useState("all");

  const filtered = useMemo(() => filterToolsByCategory(activeId), [activeId]);
  const activeLabel = categories.find((c) => c.id === activeId)?.label ?? "全部";
  const totalCount = getToolkitTools().length;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setActiveId(resolveCategoryId(categories, initialCategory));
  }, [open, initialCategory, categories]);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const cat = (e as CustomEvent<ToolkitOpenDetail>).detail?.filterCategory;
      if (cat !== undefined) setActiveId(resolveCategoryId(categories, cat));
    };
    window.addEventListener(TOOLKIT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(TOOLKIT_OPEN_EVENT, onOpen);
  }, [categories]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      id="toolkit"
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="toolkit-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="关闭工具箱"
        onClick={onClose}
      />

      <div className="hero-ai-panel relative z-10 flex max-h-[min(92vh,880px)] w-full max-w-5xl flex-col rounded-t-3xl sm:rounded-3xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <h2 id="toolkit-title" className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
              实用工具箱
            </h2>
            <p className="mt-1.5 text-sm text-white/40">
              {activeId === "all"
                ? `共 ${totalCount} 款工具 · 首页已展示的未重复列出`
                : `正在查看：${activeLabel}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/50 ring-1 ring-white/[0.1] transition-colors hover:bg-white/[0.09] hover:text-white/80"
            aria-label="关闭"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="工具分类">
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
                      ? "bg-white/12 text-white ring-1 ring-white/20"
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
              className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 auto-rows-fr"
            >
              {filtered.map((tool, index) => (
                <BentoToolCard key={tool.id} tool={tool} index={index} />
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-6 py-14 text-center">
              <p className="text-white/50">该分类下暂无更多工具</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
