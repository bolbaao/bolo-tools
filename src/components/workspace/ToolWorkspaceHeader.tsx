"use client";

import { ToolIconBox } from "@/components/icons/ToolIcon";
import { useOptionalWorkspaceChat } from "@/contexts/WorkspaceChatContext";
import { useDisplayContent } from "@/hooks/useDisplayContent";
import type { Tool } from "@/lib/tools";

function AiSearchHeroArt() {
  return (
    <div className="tool-page-hero-art" aria-hidden>
      <div className="tool-page-hero-art-globe" />
      <div className="tool-page-hero-art-card tool-page-hero-art-card--1" />
      <div className="tool-page-hero-art-card tool-page-hero-art-card--2" />
      <div className="tool-page-hero-art-lens" />
    </div>
  );
}

export default function ToolWorkspaceHeader({ tool }: { tool: Tool }) {
  const chatCtx = useOptionalWorkspaceChat();
  const { getToolHeroSubtitle } = useDisplayContent();
  const subtitle = getToolHeroSubtitle(tool.id);
  const isAiSearch = tool.id === "ai-search";

  return (
    <div className={`tool-page-header${isAiSearch ? " tool-page-header--landing" : ""}`} data-tool-tag={tool.tag}>
      {chatCtx ? (
        <button
          type="button"
          onClick={chatCtx.backToChat}
          className="tool-page-back group"
          aria-label="返回对话"
        >
          <svg
            className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 19l-7-7 7-7" />
          </svg>
          <span>返回</span>
        </button>
      ) : null}

      <div className={`tool-page-hero${isAiSearch ? " tool-page-hero--ai-search" : ""}`}>
        <div className="tool-page-header-main">
          <ToolIconBox id={tool.id} size="md" className="tool-page-header-icon shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="tool-page-header-title-row">
              <h1 className="tool-page-title">{tool.title}</h1>
              <span className="tool-page-tag">{tool.tag}</span>
            </div>
            {subtitle ? <p className="tool-page-subtitle">{subtitle}</p> : null}
          </div>
          {isAiSearch ? <AiSearchHeroArt /> : null}
        </div>
      </div>
    </div>
  );
}
