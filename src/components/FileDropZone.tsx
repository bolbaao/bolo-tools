"use client";

import { useCallback, useRef, useState } from "react";

type Props = {
  accept?: string;
  multiple?: boolean;
  icon?: string;
  title: string;
  hint?: string;
  accent?: "amber" | "cyan" | "violet" | "teal";
  onFiles: (files: File[]) => void;
  className?: string;
};

const ACCENT: Record<NonNullable<Props["accent"]>, string> = {
  amber: "hover:border-amber-500/35 hover:bg-amber-500/5 border-amber-400/30",
  cyan: "hover:border-cyan-500/35 hover:bg-cyan-500/5 border-cyan-400/30",
  violet: "hover:border-violet-500/35 hover:bg-violet-500/5 border-violet-400/30",
  teal: "hover:border-teal-500/35 hover:bg-teal-500/5 border-teal-400/30",
};

export default function FileDropZone({
  accept,
  multiple,
  icon = "📁",
  title,
  hint,
  accent = "violet",
  onFiles,
  className = "",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const pick = useCallback(
    (list: FileList | null) => {
      if (!list?.length) return;
      onFiles(Array.from(list));
    },
    [onFiles],
  );

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-8 cursor-pointer transition-all ${
        dragActive
          ? `bg-white/[0.04] ${ACCENT[accent].split(" ").slice(2).join(" ")}`
          : `border-white/15 bg-white/[0.02] ${ACCENT[accent].split(" ").slice(0, 2).join(" ")}`
      } ${className}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        pick(e.dataTransfer.files);
      }}
    >
      <span className="text-3xl opacity-60">{icon}</span>
      <span className="text-sm text-white/50">{title}</span>
      {hint ? <span className="text-xs text-white/25">{hint}</span> : null}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => pick(e.target.files)}
      />
    </div>
  );
}
