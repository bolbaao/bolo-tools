"use client";

import { useEffect } from "react";

export default function PageShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.body.classList.add("page-entering");
    const t = window.setTimeout(() => {
      document.body.classList.remove("page-entering");
      document.body.classList.add("page-ready");
    }, 80);

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest("a, button, input, textarea, [role='tab']")) return;

      const ripple = document.createElement("span");
      ripple.className = "click-ripple";
      ripple.style.left = `${e.clientX}px`;
      ripple.style.top = `${e.clientY}px`;
      document.body.appendChild(ripple);
      ripple.addEventListener("animationend", () => ripple.remove());
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", onPointerDown);
      document.body.classList.remove("page-entering", "page-ready");
    };
  }, []);

  return <>{children}</>;
}
