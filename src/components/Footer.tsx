import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-white/[0.06]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 text-xs font-bold text-white">
              菠
            </span>
            <p className="text-sm text-white/40">菠萝工具箱 · 为创作而生</p>
          </div>
          <div className="flex gap-6 text-sm text-white/35">
            <Link href="/" className="hover:text-white/60 transition-colors">
              首页
            </Link>
            <Link href="/#tools" className="hover:text-white/60 transition-colors">
              工具
            </Link>
          </div>
        </div>
        <p className="mt-8 text-center text-[11px] text-white/20">
          © {new Date().getFullYear()} Pineapple Toolkit
        </p>
      </div>
    </footer>
  );
}
