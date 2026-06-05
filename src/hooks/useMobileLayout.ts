"use client";

import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 1023px)";
const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

/** 服务端与首屏：移动端默认收起侧边栏 */
export function readInitialSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return true;
  if (window.matchMedia(MOBILE_QUERY).matches) return true;
  return sessionStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
}

/** 当前是否为移动端布局（≤1023px） */
export function useMobileLayout(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(MOBILE_QUERY).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return isMobile;
}
