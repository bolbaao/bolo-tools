"use client";

import { useAuth } from "@/contexts/AuthContext";
import { verifyEmailToken } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function VerifyEmailPageClient() {
  const searchParams = useSearchParams();
  const { refresh } = useAuth();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("正在验证邮箱…");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage("验证链接无效");
      return;
    }

    verifyEmailToken(token)
      .then(async (data) => {
        await refresh();
        setStatus("ok");
        setMessage(data.message || "邮箱验证成功");
      })
      .catch((e) => {
        setStatus("error");
        setMessage(e instanceof ApiError ? e.message : "验证失败");
      });
  }, [searchParams, refresh]);

  return (
    <div className="flex flex-col items-center justify-center py-8 sm:py-12">
      <div className="bento-card mx-auto w-full max-w-md p-8 text-center">
        {status === "loading" && (
          <p className="text-sm text-white/60 animate-pulse">{message}</p>
        )}
        {status === "ok" && (
          <>
            <p className="text-lg font-medium text-emerald-300">{message}</p>
            <p className="mt-3 text-sm text-white/45">记忆库等功能已解锁。</p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center sm:gap-3">
              <Link
                href="/tools/memory"
                className="rounded-full bg-[#18181c] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#18181c]/90"
              >
                记忆库
              </Link>
              <Link
                href="/"
                className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-white/75 hover:bg-white/5"
              >
                返回首页
              </Link>
            </div>
          </>
        )}
        {status === "error" && (
          <>
            <p className="text-lg font-medium text-red-300/90">{message}</p>
            <p className="mt-3 text-sm text-white/45">登录后可在页面顶部重新发送验证邮件。</p>
            <Link
              href="/"
              className="mt-6 inline-block rounded-full border border-white/15 px-5 py-2.5 text-sm text-white/80 hover:bg-white/5"
            >
              返回首页
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
