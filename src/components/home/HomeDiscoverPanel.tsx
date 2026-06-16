"use client";

import FeaturedToolCard from "@/components/home/FeaturedToolCard";
import { useWorkspaceChat } from "@/contexts/WorkspaceChatContext";
import { useDisplayContent } from "@/hooks/useDisplayContent";
import { pickRandomGreeting } from "@/lib/chat-greetings";
import { getFeaturedTools } from "@/lib/site-content";
import { useMemo } from "react";

export default function HomeDiscoverPanel() {
  const { sendMessage, setDialogExpanded } = useWorkspaceChat();
  const { quickChatPrompts, getToolDescription, isAdmin } = useDisplayContent();
  const greeting = useMemo(() => pickRandomGreeting(), []);
  const featuredTools = useMemo(() => getFeaturedTools(), []);

  const onQuickPrompt = (text: string) => {
    setDialogExpanded(true);
    void sendMessage(text);
  };

  return (
    <div className="home-discover">
      <div className="home-discover-hero">
        <div className="home-discover-logo" aria-hidden>
          ✦
        </div>
        <h2 className="home-discover-title">{greeting}</h2>
      </div>

      <section className="home-discover-section">
        <div className="home-discover-section-head">
          <h3 className="home-discover-section-title">
            {isAdmin ? "热门工具" : "大家都在用"}
          </h3>
          <p className="home-discover-section-desc">
            {isAdmin ? "创作者最常用的能力，点卡片直达" : "点一下就能开始，不用先找菜单"}
          </p>
        </div>
        <div className="home-discover-tools">
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

      <section className="home-discover-section home-discover-section-last">
        <h3 className="home-discover-section-title">试试这样说</h3>
        <p className="home-discover-section-desc">
          {isAdmin ? "点一下即可发送，AI 会帮你选工具并预填" : "点一下就能发，我来帮你找工具"}
        </p>
        <div className="home-discover-prompts">
          {quickChatPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onQuickPrompt(prompt)}
              className="home-discover-prompt"
            >
              {prompt}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
