"use client";

import FeaturedToolCard from "@/components/home/FeaturedToolCard";
import ToolkitModal from "@/components/home/ToolkitModal";
import { featuredTools } from "@/lib/featured-tools";
import { TOOLKIT_OPEN_EVENT, type ToolkitOpenDetail } from "@/lib/toolkit";
import { useCallback, useEffect, useState } from "react";

export default function FeaturedToolsSection() {
  const [toolkitOpen, setToolkitOpen] = useState(false);
  const [toolkitCategory, setToolkitCategory] = useState<string | undefined>();

  const openToolkit = useCallback(() => {
    setToolkitOpen(true);
    if (window.location.hash !== "#toolkit") {
      window.history.replaceState(null, "", "#toolkit");
    }
  }, []);

  const closeToolkit = useCallback(() => {
    setToolkitOpen(false);
    setToolkitCategory(undefined);
    if (window.location.hash === "#toolkit") {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  useEffect(() => {
    const syncFromHash = () => {
      if (window.location.hash === "#toolkit") setToolkitOpen(true);
    };
    const onToolkitOpen = (e: Event) => {
      setToolkitOpen(true);
      const cat = (e as CustomEvent<ToolkitOpenDetail>).detail?.filterCategory;
      if (cat !== undefined) setToolkitCategory(cat);
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    window.addEventListener(TOOLKIT_OPEN_EVENT, onToolkitOpen);
    return () => {
      window.removeEventListener("hashchange", syncFromHash);
      window.removeEventListener(TOOLKIT_OPEN_EVENT, onToolkitOpen);
    };
  }, []);

  return (
    <>
      <section id="featured" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="reveal reveal-d2 mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">工具</h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {featuredTools.map((tool, index) => (
            <FeaturedToolCard
              key={tool.id}
              tool={tool}
              index={index}
              onOpenToolkit={tool.id === "toolkit" ? openToolkit : undefined}
            />
          ))}
        </div>
      </section>

      <ToolkitModal
        open={toolkitOpen}
        onClose={closeToolkit}
        initialCategory={toolkitCategory}
      />
    </>
  );
}
