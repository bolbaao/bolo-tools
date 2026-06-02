"use client";

import WorkspaceFrame from "@/components/workspace/WorkspaceFrame";
import { useOptionalWorkspaceChat } from "@/contexts/WorkspaceChatContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export default function HomeWorkspace() {
  const { phase } = useWorkspace();
  const chatCtx = useOptionalWorkspaceChat();
  const active = phase === "active";
  const backChatTransition = chatCtx?.backChatTransition ?? false;

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
          <p className="home-hero-enter-hint home-hero-fade mt-10 text-sm font-medium tracking-wide text-white/55">
            点击进去
          </p>
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
