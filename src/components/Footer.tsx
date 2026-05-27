import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-white/[0.06]">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tracking-tight text-white/70">
              春雨<span className="text-[0.72em] font-medium text-white/40">集</span>
            </span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-white/35">
            <Link href="/" className="hover:text-white/60 transition-colors">
              首页
            </Link>
            <Link href="/tools/ai-tools" className="hover:text-white/60 transition-colors">
              AI工具
            </Link>
            <Link href="/#toolkit" className="hover:text-white/60 transition-colors">
              实用工具箱
            </Link>
            <Link href="/#about" className="hover:text-white/60 transition-colors">
              关于
            </Link>
          </div>
        </div>
        <p className="mt-8 text-center text-[11px] text-white/20">
          © {new Date().getFullYear()} 春雨集
        </p>
      </div>
    </footer>
  );
}
