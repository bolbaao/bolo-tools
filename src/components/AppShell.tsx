"use client";

import AppSidebar from "@/components/AppSidebar";
import HomeBackground from "@/components/home/HomeBackground";
import HomeBackgroundControl from "@/components/home/HomeBackgroundControl";
import { useMobileLayout } from "@/hooks/useMobileLayout";
import { WorkspaceChatProvider } from "@/contexts/WorkspaceChatContext";
import { WorkspaceProvider, useWorkspace } from "@/contexts/WorkspaceContext";
import { usePathname } from "next/navigation";

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMobile = useMobileLayout();
  const { phase, sidebarPinned, sidebarCollapsed, toggleSidebar, closeSidebar, startWorkspace } =
    useWorkspace();
  const sidebarOpen = sidebarPinned && !sidebarCollapsed;
  const homeIntro = pathname === "/" && phase === "intro";

  return (
    <div className="app-shell relative flex h-full min-h-0 flex-1 overflow-hidden">
      <div
        className={`app-sidebar-slot shrink-0 overflow-hidden ${
          !isMobile && sidebarOpen ? "w-[260px]" : "w-0"
        }`}
      >
        {!isMobile ? <AppSidebar onNavigate={closeSidebar} /> : null}
      </div>

      {isMobile && sidebarPinned ? (
        <div
          className="app-sidebar-mobile-layer"
          data-open={sidebarOpen ? "true" : "false"}
          aria-hidden={!sidebarOpen}
        >
          <button
            type="button"
            className="app-sidebar-backdrop"
            onClick={closeSidebar}
            aria-label="关闭导航"
            tabIndex={sidebarOpen ? 0 : -1}
          />
          <div className="app-sidebar-mobile">
            <AppSidebar onNavigate={closeSidebar} />
          </div>
        </div>
      ) : null}

      <div className="app-main relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <HomeBackground />
        {homeIntro ? <HomeBackgroundControl /> : null}
        {sidebarPinned && sidebarCollapsed ? (
          <button
            type="button"
            onClick={toggleSidebar}
            className="app-sidebar-expand absolute z-30 flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-surface-elevated/90 text-white/55 backdrop-blur-md transition-colors hover:bg-white/[0.06] hover:text-white/85"
            aria-label="展开侧边栏"
            title="展开侧边栏"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        ) : null}
        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
        {homeIntro ? (
          <button
            type="button"
            onClick={startWorkspace}
            className="home-workspace-start-overlay absolute inset-0 z-[35] cursor-pointer border-0 bg-transparent p-0"
            aria-label="点击进入工作区"
          />
        ) : null}
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <WorkspaceChatProvider>
        <AppShellInner>{children}</AppShellInner>
      </WorkspaceChatProvider>
    </WorkspaceProvider>
  );
}
