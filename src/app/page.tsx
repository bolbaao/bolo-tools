import ToolCard from "@/components/ToolCard";
import { tools } from "@/lib/tools";

export default function HomePage() {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6 sm:pt-20 lg:px-8">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-xs text-violet-300">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
            个人创作者专属
          </p>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            菠萝
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              工具箱
            </span>
          </h1>
          <p className="mt-5 text-base text-white/50 leading-relaxed sm:text-lg">
            简洁、高效、科技感十足。将常用创作流程收拢到一个页面，让你专注内容本身。
          </p>
        </div>

        <div className="mt-10 flex flex-wrap gap-6 text-sm text-white/35">
          <div className="flex items-center gap-2">
            <span className="text-violet-400 font-semibold text-white/70">11</span>
            <span>款核心工具</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-violet-400 font-semibold text-white/70">∞</span>
            <span>创作可能</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500/80" />
            <span>全端适配</span>
          </div>
        </div>
      </section>

      {/* Tools grid */}
      <section id="tools" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">全部工具</h2>
            <p className="mt-1 text-sm text-white/40">选择下方卡片进入对应功能页</p>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </section>
    </div>
  );
}
