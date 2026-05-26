"use client";

import AssetsPasswordModal from "@/components/AssetsPasswordModal";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";

const navItems = [
  { label: "首页", href: "/" },
  { label: "工具", href: "/#tools" },
];

const DOUBLE_CLICK_MS = 450;

export default function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [assetsModalOpen, setAssetsModalOpen] = useState(false);
  const lastPineappleClick = useRef(0);
  const isHome = pathname === "/";

  const onPineappleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const now = Date.now();
    if (now - lastPineappleClick.current < DOUBLE_CLICK_MS) {
      lastPineappleClick.current = 0;
      setAssetsModalOpen(true);
    } else {
      lastPineappleClick.current = now;
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50">
        <div className="border-b border-white/[0.06] bg-black/60 backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-black/40">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onPineappleClick}
                aria-label="菠萝"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 ring-1 ring-white/10 transition-transform hover:scale-105 active:scale-95 select-none"
              >
                菠
              </button>
              <Link
                href="/"
                className="hidden sm:block text-sm font-semibold tracking-tight text-white/90 hover:text-white transition-colors"
              >
                菠萝工具箱
              </Link>
            </div>

            <nav className="hidden md:flex items-center gap-1 rounded-full bg-white/5 p-1 ring-1 ring-white/8">
              {navItems.map((item) => {
                const active =
                  item.href === "/"
                    ? isHome
                    : isHome || pathname.startsWith("/tools");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                      active
                        ? "bg-white/12 text-white shadow-sm"
                        : "text-white/45 hover:text-white/80"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <button
              type="button"
              className="md:hidden flex h-9 w-9 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 text-white/80"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="菜单"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden border-b border-white/6 bg-black/90 px-4 py-3 backdrop-blur-xl">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-xl px-4 py-3 text-sm text-white/80"
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      <AssetsPasswordModal open={assetsModalOpen} onClose={() => setAssetsModalOpen(false)} />
    </>
  );
}
