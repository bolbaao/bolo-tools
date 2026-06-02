"use client";

import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

export default function AdminDeveloperBanner() {
  const { user, loading } = useAuth();

  if (loading || !user?.isAdmin) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="mt-2 rounded-xl banner-notice px-4 py-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            管理员模式已开启。部署、环境变量、开发命令与项目结构请查看
            <span className="font-medium"> 开发者手册</span>。
          </p>
          <Link
            href="/tools/developer"
            className="shrink-0 rounded-full bg-accent-muted px-4 py-1.5 text-xs font-medium text-accent-soft hover:bg-accent/15 transition-colors"
          >
            打开开发者手册
          </Link>
        </div>
      </div>
    </div>
  );
}
