"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

type Tab = "compress" | "sharpen" | "cutout" | "beautify" | "edit" | "generate";

export default function ImageStudioRedirect({ tab }: { tab: Tab }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`/tools/image-studio/?${params.toString()}`);
  }, [router, searchParams, tab]);

  return (
    <p className="text-center text-sm text-white/40 py-12">正在跳转到图像工坊…</p>
  );
}
