"use client";

import { readInitialSidebarCollapsed } from "@/hooks/useMobileLayout";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const MOBILE_QUERY = "(max-width: 1023px)";

export type WorkspacePhase = "intro" | "active";

const STORAGE_KEY = "workspace-started";

function isToolPath(path: string) {
  return path === "/tools" || path.startsWith("/tools/");
}

type WorkspaceContextValue = {
  phase: WorkspacePhase;
  /** 首页引导阶段为 false；进入工作区后为 true，切换应用时保持不变 */
  sidebarPinned: boolean;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  startWorkspace: () => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function readStarted(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(STORAGE_KEY) === "1";
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  const [phase, setPhase] = useState<WorkspacePhase>("intro");

  useEffect(() => {
    if (isHome) {
      setPhase(readStarted() ? "active" : "intro");
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, "1");
    setPhase("active");
  }, [isHome]);

  const sidebarPinned = phase === "active" || isToolPath(pathname);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readInitialSidebarCollapsed);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const sync = () => {
      if (mq.matches) setSidebarCollapsed(true);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia(MOBILE_QUERY).matches) setSidebarCollapsed(true);
  }, [pathname]);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarCollapsed(true);
  }, []);

  const startWorkspace = useCallback(() => {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setPhase("active");
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        phase,
        sidebarPinned,
        sidebarCollapsed,
        setSidebarCollapsed,
        toggleSidebar,
        closeSidebar,
        startWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
