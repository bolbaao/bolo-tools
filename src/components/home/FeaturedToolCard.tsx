"use client";

import type { FeaturedTool } from "@/lib/featured-tools";
import { ToolIconBox } from "@/components/icons/ToolIcon";
import { buildAgentPrefillHref } from "@/lib/agent-prefill-href";
import { inferDocConvertModeFromFiles } from "@/lib/doc-convert-prefill";
import { saveToolPrefillFiles } from "@/lib/tool-prefill-files";
import Link from "next/link";
import { useRef, useState } from "react";

type Props = {
  tool: FeaturedTool;
  index?: number;
  onOpenToolkit?: () => void;
};

const cardClass =
  "featured-tool-card group block h-full reveal text-left w-full cursor-pointer";

function CardBody({ tool, isToolkit }: { tool: FeaturedTool; isToolkit: boolean }) {
  return (
    <article className="relative flex h-full flex-col p-6 sm:p-7">
      <ToolIconBox id={tool.id} size="md" />

      <h3 className="mt-5 text-lg font-semibold tracking-tight text-white transition-colors group-hover:text-white">
        {tool.title}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-white/42 line-clamp-3">
        {tool.description}
      </p>

      <div className="mt-6 flex items-center justify-between border-t border-white/[0.06] pt-5">
        <span className="text-sm font-medium text-white/55 transition-colors group-hover:text-violet-200/90">
          {isToolkit ? "打开工具箱" : "进入工具"}
        </span>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.04] text-white/45 ring-1 ring-white/[0.08] transition-all duration-500 group-hover:-translate-y-0.5 group-hover:bg-violet-500/15 group-hover:text-white group-hover:ring-violet-400/30">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={isToolkit ? "M4 6h16M4 12h16M4 18h16" : "M9 5l7 7-7 7"}
            />
          </svg>
        </span>
      </div>
    </article>
  );
}

function FeaturedDocConvertCard({ tool, index = 0 }: { tool: FeaturedTool; index?: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const style = { transitionDelay: `${0.08 + index * 0.06}s` };

  const onPick = async (list: FileList | null) => {
    if (!list?.length || busy) return;
    const picked = Array.from(list);
    const mode = inferDocConvertModeFromFiles(picked);
    if (!mode) {
      setError("请上传 PDF、Word 或图片文件");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await saveToolPrefillFiles("doc-convert", picked);
      const href = buildAgentPrefillHref("doc-convert", { mode });
      window.location.assign(href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法保存文件，请重试");
      setBusy(false);
    }
  };

  return (
    <div className={cardClass} style={style}>
      <article className="relative flex h-full flex-col p-6 sm:p-7">
        <ToolIconBox id={tool.id} size="md" />

        <h3 className="mt-5 text-lg font-semibold tracking-tight text-white">{tool.title}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-white/42 line-clamp-3">
          {tool.description}
        </p>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"
          multiple
          className="hidden"
          onChange={(e) => void onPick(e.target.files)}
        />

        <div className="mt-5 space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="w-full rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-3 text-sm text-white/60 transition-colors hover:border-violet-400/30 hover:bg-violet-500/10 hover:text-white/80 disabled:opacity-50"
          >
            {busy ? "正在跳转…" : "上传文档并转换"}
          </button>
          {error && <p className="text-xs text-red-300/90">{error}</p>}
        </div>

        <Link
          href={tool.href}
          className="mt-4 text-xs text-white/35 transition-colors hover:text-violet-200/80"
          onClick={(e) => e.stopPropagation()}
        >
          进入工具页手动选择 →
        </Link>
      </article>
    </div>
  );
}

export default function FeaturedToolCard({ tool, index = 0, onOpenToolkit }: Props) {
  const isToolkit = tool.id === "toolkit";
  const style = { transitionDelay: `${0.08 + index * 0.06}s` };

  if (tool.id === "doc-convert") {
    return <FeaturedDocConvertCard tool={tool} index={index} />;
  }

  if (isToolkit && onOpenToolkit) {
    return (
      <button type="button" onClick={onOpenToolkit} className={cardClass} style={style}>
        <CardBody tool={tool} isToolkit />
      </button>
    );
  }

  return (
    <Link href={tool.href} className={cardClass} style={style}>
      <CardBody tool={tool} isToolkit={isToolkit} />
    </Link>
  );
}
