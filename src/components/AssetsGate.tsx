"use client";

import AssetsPanel from "@/components/tools/AssetsPanel";
import { checkAssetsSession } from "@/lib/assets";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function AssetsGate() {
  const [status, setStatus] = useState<"loading" | "ok" | "denied">("loading");

  useEffect(() => {
    checkAssetsSession()
      .then((ok) => setStatus(ok ? "ok" : "denied"))
      .catch(() => setStatus("denied"));
  }, []);

  if (status === "loading") {
    return (
      <p className="text-center text-sm text-white/40 py-20">验证访问权限…</p>
    );
  }

  if (status === "denied") {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-white/50">未登录或会话已过期</p>
        <p className="text-xs text-white/30">请在首页连续点击两次「菠」图标并输入密码</p>
        <Link
          href="/"
          className="inline-flex rounded-full bg-white/10 px-5 py-2 text-sm text-white/80 hover:bg-white/15"
        >
          返回首页
        </Link>
      </div>
    );
  }

  return <AssetsPanel />;
}
