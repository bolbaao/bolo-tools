import Link from "next/link";
import type { Tool } from "@/lib/tools";

type Props = {
  tool: Tool;
  children: React.ReactNode;
};

export default function ToolPageLayout({ tool, children }: Props) {
  return (
    <div className="relative min-h-[calc(100vh-4rem)]">
      <div className="glow-orb -top-20 right-0 h-64 w-64 bg-violet-600/20" />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-white/45 hover:text-white/80 transition-colors mb-8"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回首页
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 border border-white/10 text-2xl">
            {tool.icon}
          </span>
          <div>
            <span className="text-[10px] uppercase tracking-widest text-violet-400/80">{tool.tag}</span>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{tool.title}</h1>
            <p className="mt-1 text-sm text-white/45">{tool.description}</p>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 sm:p-8">{children}</div>

        <p className="mt-6 text-center text-xs text-white/25">
          演示模式 · 功能即将上线
        </p>
      </div>
    </div>
  );
}
