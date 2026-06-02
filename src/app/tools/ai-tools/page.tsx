import Link from "next/link";
import { getToolById } from "@/lib/tools";

const AI_TOOL_IDS = [
  "ai-chat",
  "ai-search",
  "app-builder",
  "ai-writer",
  "ai-workflow",
] as const;

export default function AiToolsPage() {
  const aiTools = AI_TOOL_IDS.map((id) => getToolById(id)).filter(Boolean);

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)]">
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24 text-center">
        <nav className="mb-10 flex items-center justify-center gap-2 text-sm text-white/35">
          <Link href="/" className="hover:text-white/60 transition-colors">
            首页
          </Link>
          <span className="text-white/15">/</span>
          <span className="text-white/55">AI 工具</span>
        </nav>

        <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/25 to-blue-500/15 text-3xl ring-1 ring-violet-500/30">
          ✦
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">AI 工具</h1>
        <p className="mt-4 text-base leading-relaxed text-white/45 sm:text-lg">
          对话、搜索、写作、做 App 与工作流 — 一站完成智能创作。
        </p>
        <p className="mt-2 text-sm text-white/30">选择下方工具进入，按页面指引即可使用。</p>

        <ul className="mt-12 space-y-3 text-left">
          {aiTools.map((tool) => (
            <li
              key={tool!.id}
              className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3.5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-white/85">{tool!.title}</span>
                  <p className="mt-1 text-xs text-white/40 leading-relaxed">{tool!.description}</p>
                </div>
                <Link
                  href={tool!.href}
                  className="shrink-0 rounded-full bg-violet-500/20 px-3 py-1 text-xs font-medium text-violet-200 ring-1 ring-violet-500/35 hover:bg-violet-500/30 transition-colors"
                >
                  进入 →
                </Link>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex rounded-full border border-white/15 px-5 py-2.5 text-sm text-white/60 hover:text-white hover:border-white/25 transition-colors"
          >
            返回首页
          </Link>
          <Link
            href="/#toolkit"
            className="inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-medium text-[#0a0b14] hover:bg-white/92 transition-colors"
          >
            实用工具箱
          </Link>
        </div>
      </div>
    </div>
  );
}
