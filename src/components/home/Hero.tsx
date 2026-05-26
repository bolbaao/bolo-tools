"use client";

import { useEffect, useRef } from "react";

export default function Hero() {
  const orbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const orb = orbRef.current;
    if (!orb) return;

    const onMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 24;
      const y = (e.clientY / window.innerHeight - 0.5) * 16;
      orb.style.transform = `translate(${x}px, ${y}px)`;
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <section className="relative mx-auto max-w-7xl px-4 pt-16 pb-12 sm:px-6 sm:pt-24 sm:pb-16 lg:px-8 lg:pt-28">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div className="reveal relative z-10">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/60 backdrop-blur-xl">
            <span className="relative flex h-2 w-2">
              <span className="absolute h-full w-full animate-ping rounded-full bg-blue-400/60" />
              <span className="relative h-2 w-2 rounded-full bg-gradient-to-r from-blue-400 to-violet-400" />
            </span>
            Designed for creators
          </p>

          <h1 className="mt-8 text-[2.75rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            <span className="text-gradient-hero">菠萝</span>
            <br />
            <span className="text-shimmer">工具箱</span>
          </h1>

          <p className="mt-6 max-w-md text-lg leading-relaxed text-white/45 font-light">
            苹果级简洁体验。图片、音视频、AI 与运营工具，收拢于一个优雅的创作工作台。
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href="#tools"
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-violet-600 px-7 py-3.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-violet-500/35 hover:scale-[1.02] active:scale-[0.98]"
            >
              探索工具
              <svg
                className="h-4 w-4 transition-transform group-hover:translate-y-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </a>
            <span className="text-sm text-white/35">本地实装 · 10 款能力</span>
          </div>
        </div>

        <div className="reveal reveal-d2 relative flex justify-center lg:justify-end">
          <div
            ref={orbRef}
            className="hero-float relative w-full max-w-md aspect-square transition-transform duration-300 ease-out"
          >
            <div className="absolute inset-[8%] rounded-[2.5rem] bg-gradient-to-br from-blue-500/30 via-violet-600/20 to-indigo-900/40 blur-2xl" />
            <div className="absolute inset-[12%] rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.08] to-transparent backdrop-blur-3xl shadow-2xl shadow-blue-900/30 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-white/5" />
              <div className="relative h-full flex flex-col items-center justify-center p-8 gap-4">
                <div className="grid grid-cols-3 gap-2 w-full max-w-[200px]">
                  {["AI", "图像", "视频", "音频", "运营", "开发"].map((label) => (
                    <div
                      key={label}
                      className="rounded-xl bg-white/5 border border-white/10 py-2 text-center text-[10px] text-white/50 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white/80"
                    >
                      {label}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-white/30 tracking-widest uppercase">Bento Toolkit</p>
              </div>
            </div>
            <div className="absolute -top-2 -right-2 h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-400/40 to-violet-500/30 blur-xl animate-pulse" />
            <div
              className="absolute -bottom-4 -left-4 h-24 w-24 rounded-full bg-violet-600/25 blur-2xl"
              style={{ animation: "orb-drift-b 8s ease-in-out infinite" }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
