"use client";

import { CHAT_FILE_ACCEPT } from "@/lib/chat-files";
import { useRef } from "react";

type ChatAttachButtonProps = {
  onFiles: (files: File[]) => void | Promise<void>;
  disabled?: boolean;
  busy?: boolean;
  className?: string;
  title?: string;
  accept?: string;
};

export default function ChatAttachButton({
  onFiles,
  disabled,
  busy,
  className = "",
  title = "上传图片、PDF 或 Word",
  accept,
}: ChatAttachButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept ?? CHAT_FILE_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          const list = e.target.files;
          if (list?.length) void onFiles(Array.from(list));
          e.target.value = "";
        }}
      />
      <button
        type="button"
        title={title}
        aria-label={title}
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        className={
          className ||
          "group/attach shrink-0 flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:border-violet-500/35 hover:bg-violet-500/8 disabled:opacity-40 transition-colors"
        }
      >
        <svg
          className="h-[22px] w-[22px] text-white/75 transition-opacity group-hover/attach:opacity-100"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
          />
        </svg>
      </button>
    </>
  );
}
