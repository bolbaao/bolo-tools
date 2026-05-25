import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-white/8 mt-auto">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-white/90">菠萝工具箱</p>
            <p className="mt-1 text-xs text-white/40 max-w-md leading-relaxed">
              面向个人创作者的一站式工具集合。当前为前端演示版本，功能接口将陆续接入。
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-white/40">
            <Link href="/" className="hover:text-white/70 transition-colors">
              首页
            </Link>
            <span className="text-white/20">·</span>
            <span>© {new Date().getFullYear()} Pineapple Toolkit</span>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-white/5 text-center text-[11px] text-white/25">
          简洁 · 高效 · 为创作而生
        </div>
      </div>
    </footer>
  );
}
