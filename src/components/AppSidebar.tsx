"use client";

import AuthModal from "@/components/AuthModal";
import { ToolIcon } from "@/components/icons/ToolIcon";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { CATEGORY_ORDER, getPersonalCenterTools, getSidebarTools, type Tool } from "@/lib/tools";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

function groupToolsByCategory(allTools: Tool[]) {
  const groups = new Map<string, Tool[]>();
  for (const tool of allTools) {
    const list = groups.get(tool.tag) ?? [];
    list.push(tool);
    groups.set(tool.tag, list);
  }
  return CATEGORY_ORDER.filter((tag) => groups.has(tag)).map((tag) => ({
    tag,
    tools: groups.get(tag)!,
  }));
}

export default function AppSidebar() {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const { toggleSidebar } = useWorkspace();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  const categories = useMemo(() => groupToolsByCategory(getSidebarTools()), []);
  const personalTools = useMemo(() => getPersonalCenterTools(), []);

  const openAuth = (mode: "login" | "register") => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  return (
    <aside className="app-sidebar flex h-full w-[260px] shrink-0 flex-col border-r border-white/[0.06] bg-surface-elevated/80 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-4">
        <Link
          href="/"
          scroll={false}
          className="min-w-0 text-[1.05rem] font-semibold tracking-tight text-white/92 hover:text-white transition-colors"
          aria-label="春雨集首页"
        >
          春雨<span className="text-[0.72em] font-medium text-white/55 align-baseline">集</span>
        </Link>
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/35 transition-colors hover:bg-white/[0.06] hover:text-white/70"
          aria-label="收起侧边栏"
          title="收起侧边栏"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <nav className="custom-scrollbar flex-1 overflow-y-auto px-3 py-4" aria-label="工具导航">
        {categories.map(({ tag, tools: categoryTools }) => (
          <div key={tag} className="sidebar-category mb-5 last:mb-0">
            <p className="mb-2 px-2 text-[10px] font-medium uppercase tracking-widest text-white/30">
              {tag}
            </p>
            <ul className="space-y-0.5">
              {categoryTools.map((tool) => {
                const active = pathname === tool.href || pathname.startsWith(`${tool.href}/`);
                return (
                  <li key={tool.id}>
                    <Link
                      href={tool.href}
                      scroll={false}
                      className={`sidebar-nav-link group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm ${
                        active
                          ? "nav-link-active"
                          : "text-white/50 hover:bg-white/[0.05] hover:text-white/80"
                      }`}
                    >
                      {active && <span className="sidebar-active-bar" aria-hidden />}
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] ring-1 ring-white/[0.06]">
                        <ToolIcon id={tool.id} className="h-4 w-4 tool-icon-glow" />
                      </span>
                      <span className="truncate">{tool.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {user?.isAdmin && (
          <div className="mb-5">
            <p className="mb-2 px-2 text-[10px] font-medium uppercase tracking-widest text-white/30">
              管理
            </p>
            <ul className="space-y-0.5">
              <li>
                <Link
                  href="/tools/developer"
                  scroll={false}
                  className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors ${
                    pathname === "/tools/developer"
                      ? "nav-link-active"
                      : "text-white/50 hover:bg-white/[0.05] hover:text-white/80"
                  }`}
                >
                  开发者手册
                </Link>
              </li>
              <li>
                <Link
                  href="/tools/admin"
                  scroll={false}
                  className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors ${
                    pathname === "/tools/admin"
                      ? "nav-link-active"
                      : "text-white/50 hover:bg-white/[0.05] hover:text-white/80"
                  }`}
                >
                  用户管理
                </Link>
              </li>
            </ul>
          </div>
        )}
      </nav>

      <div className="shrink-0 border-t border-white/[0.06] px-3 py-3">
        <p className="mb-2 px-1 text-[10px] font-medium uppercase tracking-widest text-white/30">
          个人中心
        </p>

        {!loading && user ? (
          <div className="space-y-1">
            <div className="rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-white/[0.06]">
              <p className="truncate text-xs font-medium text-white/70" title={user.username}>
                {user.username}
              </p>
            </div>
            <ul className="space-y-0.5">
              {personalTools.map((tool) => {
                const active = pathname === tool.href || pathname.startsWith(`${tool.href}/`);
                return (
                  <li key={tool.id}>
                    <Link
                      href={tool.href}
                      scroll={false}
                      className={`sidebar-nav-link group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm ${
                        active
                          ? "nav-link-active"
                          : "text-white/50 hover:bg-white/[0.05] hover:text-white/80"
                      }`}
                    >
                      {active && <span className="sidebar-active-bar" aria-hidden />}
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] ring-1 ring-white/[0.06]">
                        <ToolIcon id={tool.id} className="h-4 w-4 tool-icon-glow" />
                      </span>
                      <span className="truncate">{tool.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={() => void logout()}
              className="w-full rounded-xl px-2.5 py-2 text-left text-[11px] text-white/35 transition-colors hover:bg-white/[0.04] hover:text-white/60"
            >
              退出登录
            </button>
          </div>
        ) : !loading ? (
          <div className="space-y-1.5">
            {personalTools.map((tool) => (
              <Link
                key={tool.id}
                href={tool.href}
                scroll={false}
                className="sidebar-nav-link flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-white/45 transition-colors hover:bg-white/[0.05] hover:text-white/70"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] ring-1 ring-white/[0.06]">
                  <ToolIcon id={tool.id} className="h-4 w-4 tool-icon-glow" />
                </span>
                <span className="truncate">{tool.title}</span>
              </Link>
            ))}
            <button
              type="button"
              onClick={() => openAuth("login")}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/55 transition-colors hover:bg-white/[0.07] hover:text-white/80"
            >
              登录 / 注册
            </button>
          </div>
        ) : null}

        <p className="mt-3 text-center text-[10px] text-white/18">
          © {new Date().getFullYear()} 春雨集
        </p>
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} initialMode={authMode} />
    </aside>
  );
}
