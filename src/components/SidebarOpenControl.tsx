"use client";

import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useMobileLayout } from "@/hooks/useMobileLayout";
import { useCallback, useEffect, useRef } from "react";

function MenuIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

type Props = {
  /** 嵌入工具页顶栏时使用紧凑样式 */
  variant?: "floating" | "inline";
};

export function SidebarOpenButton({ variant = "floating" }: Props) {
  const { openSidebar } = useWorkspace();

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={openSidebar}
        className="tool-page-menu"
        aria-label="打开导航菜单"
        title="打开导航菜单 (⌘B)"
      >
        <MenuIcon className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openSidebar}
      className="app-sidebar-open-btn"
      aria-label="打开导航菜单"
      title="打开导航菜单 (⌘B)"
    >
      <MenuIcon />
      <span className="app-sidebar-open-label">菜单</span>
    </button>
  );
}

/** 左侧边缘滑动 / 点击打开侧边栏 */
export function SidebarEdgeOpen() {
  const isMobile = useMobileLayout();
  const { sidebarPinned, sidebarCollapsed, openSidebar } = useWorkspace();
  const trackingRef = useRef<{ x: number; y: number } | null>(null);

  const enabled = sidebarPinned && sidebarCollapsed;

  const onEdgeClick = useCallback(() => {
    if (enabled) openSidebar();
  }, [enabled, openSidebar]);

  useEffect(() => {
    if (!enabled || !isMobile) return;

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t || t.clientX > 28) return;
      trackingRef.current = { x: t.clientX, y: t.clientY };
    };

    const onTouchMove = (e: TouchEvent) => {
      const start = trackingRef.current;
      const t = e.touches[0];
      if (!start || !t) return;
      const dx = t.clientX - start.x;
      const dy = Math.abs(t.clientY - start.y);
      if (dx > 56 && dy < 48) {
        openSidebar();
        trackingRef.current = null;
      }
    };

    const onTouchEnd = () => {
      trackingRef.current = null;
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [enabled, isMobile, openSidebar]);

  if (!enabled) return null;

  return (
    <button
      type="button"
      className="app-sidebar-edge-hit"
      onClick={onEdgeClick}
      aria-label="从左侧边缘打开导航"
      title="打开导航"
    />
  );
}

export default function SidebarOpenControl({ variant = "floating" }: Props) {
  return (
    <>
      <SidebarOpenButton variant={variant} />
      <SidebarEdgeOpen />
    </>
  );
}
