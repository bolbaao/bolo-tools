import Link from "next/link";
import ToolDemoVisual from "@/components/home/ToolDemoVisual";
import type { Tool } from "@/lib/tools";

type Props = {
  tool: Tool;
  children: React.ReactNode;
};

export default function ToolPageLayout({ tool, children }: Props) {
  return (
    <div className="relative min-h-[calc(100vh-3.5rem)]">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <nav className="mb-8 flex items-center gap-2 text-sm text-white/35">
          <Link href="/" className="hover:text-white/60 transition-colors">
            首页
          </Link>
          <span className="text-white/15">/</span>
          <Link href="/#tools" className="hover:text-white/60 transition-colors">
            工具
          </Link>
          <span className="text-white/15">/</span>
          <span className="text-white/55">{tool.title}</span>
        </nav>

        <header className="mb-8">
          <div className="bento-card overflow-hidden">
            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-start gap-4">
                <span
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${tool.gradient} text-2xl ring-1 ring-white/10`}
                >
                  {tool.icon}
                </span>
                <div className="flex-1 min-w-[200px]">
                  <span className="inline-flex rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-widest text-blue-300/90 ring-1 ring-blue-500/20">
                    {tool.tag}
                  </span>
                  <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    {tool.title}
                  </h1>
                  <p className="mt-2 text-sm text-white/40 leading-relaxed font-light">
                    {tool.description}
                  </p>
                  <p className="mt-2 text-xs text-white/25">{tool.demoHint}</p>
                </div>
              </div>
              <div className="mt-6">
                <ToolDemoVisual toolId={tool.id} large />
              </div>
            </div>
          </div>
        </header>

        <div className="glass-panel p-6 sm:p-8">{children}</div>

        <p className="mt-8 text-center text-xs text-white/20">
          部分功能需配置 .env 或本机依赖，详见 README
        </p>
      </div>
    </div>
  );
}
