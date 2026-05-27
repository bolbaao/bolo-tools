"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** 已下线，跳转首页 */
export default function AiVideoRemovedPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return <p className="text-center text-sm text-white/40 py-12">正在跳转…</p>;
}
