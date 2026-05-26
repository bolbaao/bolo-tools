"use client";

import AiChatPanel from "@/components/tools/AiChatPanel";
import Link from "next/link";

export default function HomeAiChatSection() {
  return (
    <section
      id="ai-chat"
      className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8 reveal reveal-d2"
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-400/70">
            AI
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            智能<span className="text-gradient-accent">助手</span>
          </h2>
          <p className="mt-2 text-sm text-white/40 font-light max-w-lg">
            用自然语言操作全站工具，自动跳转并预填表单
          </p>
        </div>
        <Link
          href="/tools/ai-chat"
          className="text-sm text-violet-300/80 hover:text-violet-200 transition-colors"
        >
          全屏模式 →
        </Link>
      </div>
      <div className="glass-panel p-5 sm:p-8 ring-1 ring-violet-500/10">
        <AiChatPanel />
      </div>
    </section>
  );
}
