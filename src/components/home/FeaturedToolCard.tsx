import type { FeaturedTool } from "@/lib/featured-tools";
import { ToolIconBox } from "@/components/icons/ToolIcon";
import Link from "next/link";

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

export default function FeaturedToolCard({ tool, index = 0, onOpenToolkit }: Props) {
  const isToolkit = tool.id === "toolkit";
  const style = { transitionDelay: `${0.08 + index * 0.06}s` };

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
