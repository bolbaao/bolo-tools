"use client";

import { useState } from "react";

type Props = {
  label: string;
  successMessage?: string;
  variant?: "primary" | "secondary";
  className?: string;
};

export default function MockButton({
  label,
  successMessage = "操作已提交（演示）",
  variant = "primary",
  className = "",
}: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  const handleClick = () => {
    if (status !== "idle") return;
    setStatus("loading");
    setTimeout(() => setStatus("done"), 1200);
  };

  const base =
    variant === "primary"
      ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-90 shadow-lg shadow-violet-500/20"
      : "bg-white/5 text-white/80 border border-white/10 hover:bg-white/10";

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "loading"}
        className={`w-full rounded-xl px-6 py-3 text-sm font-medium transition-all disabled:opacity-60 ${base}`}
      >
        {status === "loading" ? "处理中…" : status === "done" ? "已完成 ✓" : label}
      </button>
      {status === "done" && (
        <p className="mt-3 text-center text-xs text-emerald-400/90">{successMessage}</p>
      )}
    </div>
  );
}
