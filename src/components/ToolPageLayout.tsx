import Link from "next/link";
import { ToolIconBox } from "@/components/icons/ToolIcon";
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
          <Link href="/#toolkit" className="hover:text-white/60 transition-colors">
            工具箱
          </Link>
          <span className="text-white/15">/</span>
          <span className="text-white/55">{tool.title}</span>
        </nav>

        <header className="mb-8">
          <div className="bento-card overflow-hidden">
            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-start gap-4">
                <ToolIconBox id={tool.id} size="lg" />
                <div className="flex-1 min-w-[200px]">
                  <span className="inline-flex rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-widest text-blue-300/90 ring-1 ring-blue-500/20">
                    {tool.tag}
                  </span>
                  <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    {tool.title}
                  </h1>
                  <p className="mt-3 text-sm leading-relaxed text-white/55">{tool.description}</p>
                  <p className="mt-2 text-xs leading-relaxed text-white/40">
                    <span className="text-white/50">使用方式：</span>
                    {tool.usageGuide}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="glass-panel p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}
