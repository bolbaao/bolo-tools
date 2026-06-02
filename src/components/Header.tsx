"use client";

import AuthModal from "@/components/AuthModal";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  { label: "首页", href: "/" },
  { label: "AI工具", href: "/tools/ai-chat" },
  { label: "关于", href: "/#about" },
] as const;

function isNavActive(pathname: string, href: string, isHome: boolean) {
  if (href === "/") return isHome && pathname === "/";
  if (href === "/tools/ai-chat") return pathname.startsWith("/tools/ai");
  if (href.startsWith("/tools")) return pathname.startsWith(href);
  return false;
}

export default function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const { user, loading, logout } = useAuth();
  const isHome = pathname === "/";

  const openAuth = (mode: "login" | "register") => {
    setAuthMode(mode);
    setAuthOpen(true);
    setMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-50 px-4 pt-3 sm:px-6 lg:px-8">
        <div className="nav-glass mx-auto flex h-14 max-w-6xl items-center justify-between rounded-2xl px-4 sm:px-5">
          <Link
            href="/"
            className="text-[1.05rem] font-semibold tracking-tight text-white/92 hover:text-white transition-colors"
            aria-label="春雨集首页"
          >
            春雨<span className="text-[0.72em] font-medium text-white/55 align-baseline">集</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {navItems.map((item) => {
              const active = isNavActive(pathname, item.href, isHome);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm transition-colors ${
                    active ? "text-white" : "text-white/45 hover:text-white/75"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {!loading && user ? (
              <div className="hidden sm:flex items-center gap-2">
                {user.isAdmin && (
                  <Link
                    href="/tools/admin"
                    className="text-xs text-amber-400/70 hover:text-amber-300/90 transition-colors px-2"
                  >
                    用户管理
                  </Link>
                )}
                <span className="text-xs text-white/35 max-w-[80px] truncate" title={user.username}>
                  {user.username}
                </span>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="text-xs text-white/40 hover:text-white/70 transition-colors px-2"
                >
                  退出
                </button>
              </div>
            ) : !loading ? (
              <button
                type="button"
                onClick={() => openAuth("login")}
                className="hidden sm:inline-flex text-xs text-white/45 hover:text-white/75 transition-colors px-2"
              >
                登录
              </button>
            ) : null}

            <Link
              href="/tools/memory"
              className="hidden sm:inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-medium text-[#0a0b14] transition-all hover:bg-white/92 active:scale-[0.98]"
            >
              开始使用
            </Link>

            <button
              type="button"
              className="md:hidden flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05] ring-1 ring-white/[0.1] text-white/80"
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
          <div className="nav-glass mx-auto mt-2 max-w-6xl rounded-2xl px-2 py-2 md:hidden">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-xl px-4 py-3 text-sm text-white/75 hover:bg-white/[0.05] hover:text-white"
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            {!loading && user ? (
              <>
                {user.isAdmin && (
                  <Link
                    href="/tools/admin"
                    className="block rounded-xl px-4 py-3 text-sm text-amber-300/80 hover:bg-white/[0.05] hover:text-amber-200"
                    onClick={() => setMenuOpen(false)}
                  >
                    用户管理
                  </Link>
                )}
                <span className="block rounded-xl px-4 py-3 text-sm text-white/45">
                  {user.username}
                </span>
                <button
                  type="button"
                  className="w-full rounded-xl px-4 py-3 text-left text-sm text-white/55 hover:bg-white/[0.05]"
                  onClick={() => {
                    void logout();
                    setMenuOpen(false);
                  }}
                >
                  退出登录
                </button>
              </>
            ) : !loading ? (
              <button
                type="button"
                className="w-full rounded-xl px-4 py-3 text-left text-sm text-white/75 hover:bg-white/[0.05] hover:text-white"
                onClick={() => openAuth("login")}
              >
                登录 / 注册
              </button>
            ) : null}
            <Link
              href="/tools/memory"
              className="mt-1 block rounded-xl bg-white px-4 py-3 text-center text-sm font-medium text-[#0a0b14]"
              onClick={() => setMenuOpen(false)}
            >
              开始使用
            </Link>
          </div>
        )}
      </header>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} initialMode={authMode} />
    </>
  );
}
