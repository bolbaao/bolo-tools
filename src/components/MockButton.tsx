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
      ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-600/20 ring-1 ring-white/10 hover:shadow-violet-500/30 hover:brightness-110 active:scale-[0.98]"
      : "bg-white/5 text-white/80 border border-white/10 hover:bg-white/8 hover:border-white/15 active:scale-[0.98]";

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "loading"}
        className={`w-full rounded-xl px-6 py-3.5 text-sm font-medium transition-all disabled:opacity-60 ${base}`}
      >
        {status === "loading" ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            处理中…
          </span>
        ) : status === "done" ? (
          "已完成 ✓"
        ) : (
          label
        )}
      </button>
      {status === "done" && (
        <p className="mt-3 text-center text-xs text-emerald-400/90">{successMessage}</p>
      )}
    </div>
  );
}
