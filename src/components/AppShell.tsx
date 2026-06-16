"use client";

import AppSidebar from "@/components/AppSidebar";
import SidebarOpenControl, { SidebarEdgeOpen } from "@/components/SidebarOpenControl";
import HomeBackground from "@/components/home/HomeBackground";
import HomeBackgroundControl from "@/components/home/HomeBackgroundControl";
import { useMobileLayout } from "@/hooks/useMobileLayout";
import { WorkspaceChatProvider } from "@/contexts/WorkspaceChatContext";
import { WorkspaceProvider, useWorkspace } from "@/contexts/WorkspaceContext";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMobile = useMobileLayout();
  const { phase, sidebarPinned, sidebarCollapsed, closeSidebar, startWorkspace } =
    useWorkspace();
  const sidebarOpen = sidebarPinned && !sidebarCollapsed;
  const homeIntro = pathname === "/" && phase === "intro";
  const isToolRoute = pathname.startsWith("/tools/");

  useEffect(() => {
    if (isMobile && sidebarOpen) {
      document.body.classList.add("sidebar-open-mobile");
      return () => document.body.classList.remove("sidebar-open-mobile");
    }
  }, [isMobile, sidebarOpen]);

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
          isToolRoute ? <SidebarEdgeOpen /> : <SidebarOpenControl />
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
