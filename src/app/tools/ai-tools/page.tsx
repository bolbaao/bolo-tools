import Link from "next/link";

const PLANNED = [
  { title: "AI 对话", status: "available" as const, href: "/tools/ai-chat/" },
  { title: "AI 生图", status: "available" as const, href: "/tools/image-studio/?tab=generate" },
  { title: "AI 写作助手", status: "soon" as const },
  { title: "AI 工作流", status: "soon" as const },
];

export default function AiToolsPage() {
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
          AI 工具陆续开发中，敬请期待。
        </p>
        <p className="mt-2 text-sm text-white/30">我们会把更多智能能力收拢到这里，保持简洁好用。</p>

        <ul className="mt-12 space-y-3 text-left">
          {PLANNED.map((item) => (
            <li
              key={item.title}
              className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3.5"
            >
              <span className="text-sm text-white/80">{item.title}</span>
              {item.status === "available" && item.href ? (
                <Link
                  href={item.href}
                  className="shrink-0 rounded-full bg-violet-500/20 px-3 py-1 text-xs font-medium text-violet-200 ring-1 ring-violet-500/35 hover:bg-violet-500/30 transition-colors"
                >
                  已上线 →
                </Link>
              ) : (
                <span className="shrink-0 rounded-full bg-white/5 px-3 py-1 text-xs text-white/35 ring-1 ring-white/10">
                  开发中
                </span>
              )}
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
