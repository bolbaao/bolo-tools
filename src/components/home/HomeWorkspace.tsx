"use client";

import FeaturedToolCard from "@/components/home/FeaturedToolCard";
import WorkspaceFrame from "@/components/workspace/WorkspaceFrame";
import { useDisplayContent } from "@/hooks/useDisplayContent";
import { useOptionalWorkspaceChat } from "@/contexts/WorkspaceChatContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { getFeaturedTools } from "@/lib/site-content";
import { useMemo } from "react";

export default function HomeWorkspace() {
  const { phase } = useWorkspace();
  const chatCtx = useOptionalWorkspaceChat();
  const active = phase === "active";
  const backChatTransition = chatCtx?.backChatTransition ?? false;
  const { siteTagline, siteStats, siteValueProps, getToolDescription } = useDisplayContent();
  const featuredTools = useMemo(() => getFeaturedTools().slice(0, 3), []);

  return (
    <div
      className={`home-workspace relative flex h-full min-h-0 flex-col overflow-hidden${
        backChatTransition ? " home-workspace-back-chat" : ""
      }`}
    >
      <div
        className={`home-hero-shell z-20 flex flex-col items-center px-6 text-center lg:px-12 ${
          active ? "home-hero-shell-active" : "home-hero-shell-intro home-hero-enter"
        }`}
      >
        <h1 className="home-hero-title max-w-lg font-semibold leading-[1.15] tracking-tight text-white">
          <span className="home-hero-line home-hero-line-1 block">把日常</span>
          <span className="home-hero-line home-hero-line-2 block">变得更有想象力</span>
        </h1>
        {!active ? (
          <>
            <p className="home-hero-desc home-hero-fade mt-5 max-w-md text-sm leading-relaxed text-white/55">
              {siteTagline}
            </p>
            <div className="home-hero-fade mt-6 flex flex-wrap items-center justify-center gap-5 sm:gap-7">
              {siteStats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-base font-semibold text-white/88">{stat.value}</p>
                  <p className="mt-0.5 text-[11px] text-white/38">{stat.label}</p>
                </div>
              ))}
            </div>
            <div className="home-hero-fade mt-6 flex max-w-xl flex-wrap justify-center gap-2">
              {siteValueProps.map((item) => (
                <span
                  key={item.title}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.05] px-3 py-1.5 text-xs text-white/62 backdrop-blur-sm"
                >
                  <span aria-hidden>{item.icon}</span>
                  {item.title}
                </span>
              ))}
            </div>
            <div className="home-hero-fade mt-8 grid w-full max-w-2xl gap-2.5 sm:grid-cols-3">
              {featuredTools.map((tool) => (
                <FeaturedToolCard
                  key={tool.id}
                  tool={tool}
                  description={getToolDescription(tool.id)}
                  variant="dark"
                  compact
                  preview
                />
              ))}
            </div>
            <p className="home-hero-enter-hint home-hero-fade mt-8 text-sm font-medium tracking-wide text-white/55">
              点击任意处进入
            </p>
          </>
        ) : null}
      </div>

      <section
        className={`home-workspace-stage ${active ? "home-workspace-stage-active" : "home-workspace-stage-idle"}`}
        aria-hidden={!active}
      >
        <div className={`flex h-full min-h-0 flex-col ${active ? "" : "pointer-events-none opacity-0"}`}>
          <WorkspaceFrame dialogPlaceholder="在此输入问题…" />
        </div>
      </section>
    </div>
  );
}
