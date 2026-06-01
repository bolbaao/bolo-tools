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
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="bento-card p-8">
        {status === "loading" && (
          <p className="text-sm text-white/60 animate-pulse">{message}</p>
        )}
        {status === "ok" && (
          <>
            <p className="text-lg font-medium text-emerald-300">{message}</p>
            <p className="mt-3 text-sm text-white/45">
              对话历史、记忆库与自动记忆提取已解锁。
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center sm:gap-3">
              <Link
                href="/tools/ai-chat"
                className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-[#0a0b14] hover:bg-white/92"
              >
                去 AI 对话
              </Link>
              <Link
                href="/tools/memory"
                className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-white/75 hover:bg-white/5"
              >
                记忆库
              </Link>
            </div>
          </>
        )}
        {status === "error" && (
          <>
            <p className="text-lg font-medium text-red-300/90">{message}</p>
            <p className="mt-3 text-sm text-white/45">登录后可在页面顶部重新发送验证邮件。</p>
            <Link
              href="/tools/ai-chat"
              className="mt-6 inline-block rounded-full bg-white/10 px-5 py-2.5 text-sm text-white/80 hover:bg-white/15"
            >
              返回
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
