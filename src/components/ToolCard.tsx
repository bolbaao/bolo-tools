import Link from "next/link";
import type { Tool } from "@/lib/tools";

type Props = {
  tool: Tool;
};

export default function ToolCard({ tool }: Props) {
  return (
    <Link href={tool.href} className="tool-card group block">
      <article className="glass relative overflow-hidden rounded-2xl p-6 h-full">
        <div
          className={`absolute inset-0 bg-gradient-to-br ${tool.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
        />
        <div className="relative">
          <div className="flex items-start justify-between">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 text-2xl border border-white/10 group-hover:border-violet-500/30 transition-colors">
              {tool.icon}
            </span>
            <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] text-white/50 tracking-wide">
              {tool.tag}
            </span>
          </div>
          <h3 className="mt-5 text-lg font-semibold text-white group-hover:text-violet-200 transition-colors">
            {tool.title}
          </h3>
          <p className="mt-2 text-sm text-white/45 leading-relaxed line-clamp-2">
            {tool.description}
          </p>
          <div className="mt-5 flex items-center gap-1 text-sm text-violet-400/80 group-hover:text-violet-300 transition-colors">
            <span>进入工具</span>
            <svg
              className="h-4 w-4 transition-transform group-hover:translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </article>
    </Link>
  );
}
