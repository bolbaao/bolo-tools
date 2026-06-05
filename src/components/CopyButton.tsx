"use client";

import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

type Props = {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  disabled?: boolean;
};

export default function CopyButton({
  text,
  label = "复制",
  copiedLabel = "已复制",
  className = "",
  disabled,
}: Props) {
  const { copy, copied } = useCopyToClipboard();

  return (
    <button
      type="button"
      disabled={disabled || !text}
      onClick={() => void copy(text)}
      className={`rounded-lg bg-white/5 px-4 py-2 text-xs text-white/70 hover:bg-white/10 disabled:opacity-40 transition-colors ${className}`}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
