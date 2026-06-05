"use client";

import FeaturedToolCard from "@/components/home/FeaturedToolCard";
import { useWorkspaceChat } from "@/contexts/WorkspaceChatContext";
import { useDisplayContent } from "@/hooks/useDisplayContent";
import { pickRandomGreeting } from "@/lib/chat-greetings";
import { getFeaturedTools } from "@/lib/site-content";
import { useMemo } from "react";

export default function HomeDiscoverPanel() {
  const { sendMessage, setDialogExpanded } = useWorkspaceChat();
  const {
    siteStats,
    siteValueProps,
    quickChatPrompts,
    getToolDescription,
    isAdmin,
  } = useDisplayContent();
  const greeting = useMemo(() => pickRandomGreeting(), []);
  const featuredTools = useMemo(() => getFeaturedTools(), []);

  const onQuickPrompt = (text: string) => {
    setDialogExpanded(true);
    void sendMessage(text);
  };

  return (
    <div className="home-discover mx-auto w-full max-w-3xl space-y-10 pb-8">
      <div className="text-center">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-muted text-lg text-accent-deep/80 ring-1 ring-accent/15">
          ✦
        </div>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-black/48">{greeting}</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-6 sm:gap-8">
          {siteStats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-lg font-semibold tracking-tight text-[#1d1d1f]">{stat.value}</p>
              <p className="mt-0.5 text-[11px] text-black/38">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-[#1d1d1f]">
              {isAdmin ? "热门工具" : "大家都在用"}
            </h2>
            <p className="mt-1 text-xs text-black/40">
              {isAdmin ? "创作者最常用的能力，点卡片直达" : "点一下就能开始，不用先找菜单"}
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {featuredTools.map((tool) => (
            <FeaturedToolCard
              key={tool.id}
              tool={tool}
              description={getToolDescription(tool.id)}
              variant="light"
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold tracking-tight text-[#1d1d1f]">试试这样说</h2>
        <p className="mt-1 text-xs text-black/40">
          {isAdmin ? "点一下即可发送，AI 会帮你选工具并预填" : "点一下就能发，我来帮你找工具"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {quickChatPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onQuickPrompt(prompt)}
              className="rounded-full border border-black/[0.08] bg-white px-3.5 py-2 text-left text-[13px] text-black/58 transition-colors hover:border-accent/25 hover:bg-accent-muted/60 hover:text-[#1d1d1f]"
            >
              {prompt}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold tracking-tight text-[#1d1d1f]">
          {isAdmin ? "为什么选择春雨集" : "为什么用春雨集"}
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {siteValueProps.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-black/[0.06] bg-black/[0.02] px-4 py-4 ring-1 ring-black/[0.03]"
            >
              <span className="text-lg" aria-hidden>
                {item.icon}
              </span>
              <p className="mt-2 text-sm font-medium text-[#1d1d1f]">{item.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-black/42">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
