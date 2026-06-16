"use client";

import WorkspaceFrame from "@/components/workspace/WorkspaceFrame";
import { useDisplayContent } from "@/hooks/useDisplayContent";
import { useOptionalWorkspaceChat } from "@/contexts/WorkspaceChatContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

export default function HomeWorkspace() {
  const router = useRouter();
  const { phase } = useWorkspace();
  const chatCtx = useOptionalWorkspaceChat();
  const active = phase === "active";
  const backChatTransition = chatCtx?.backChatTransition ?? false;
  const { siteTagline } = useDisplayContent();

  const goHomeMain = useCallback(() => {
    router.push("/", { scroll: false });
    chatCtx?.setDialogExpanded(true);
    requestAnimationFrame(() => {
      document
        .querySelector(".home-workspace .workspace-panel")
        ?.scrollTo({ top: 0, behavior: "smooth" });
      document
        .querySelector(".home-workspace .workspace-chat-scroll")
        ?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, [router, chatCtx]);

  return (
    <div
      className={`home-workspace relative flex h-full min-h-0 flex-col overflow-hidden${
        backChatTransition ? " home-workspace-back-chat" : ""
      }`}
    >
      <div
        className={`home-hero-shell z-20 flex flex-col items-center px-4 text-center sm:px-6 lg:px-12 ${
          active ? "home-hero-shell-active home-hero-shell-home-link" : "home-hero-shell-intro home-hero-enter"
        }`}
        {...(active
          ? {
              role: "button",
              tabIndex: 0,
              "aria-label": "返回主页面",
              onClick: goHomeMain,
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  goHomeMain();
                }
              },
            }
          : {})}
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
        <div
          className={`home-back-panel flex h-full min-h-0 flex-col${
            backChatTransition ? " home-back-panel-enter" : ""
          } ${active ? "" : "pointer-events-none opacity-0"}`}
        >
          <WorkspaceFrame dialogPlaceholder="在此输入问题…" />
        </div>
      </section>
    </div>
  );
}
