"use client";

type Props = {
  toolId: string;
  large?: boolean;
};

/** CSS 动效占位，在视频加载失败时使用 */
export default function ToolDemoVisualFallback({ toolId, large }: Props) {
  const stage = `demo-stage ${large ? "demo-stage-lg" : ""} flex items-center justify-center`;

  switch (toolId) {
    case "ai-chat":
      return (
        <div className={`${stage} p-4 flex-col gap-2 items-stretch justify-end`}>
          <div
            className="demo-bubble self-start max-w-[75%] rounded-2xl rounded-bl-md bg-white/10 px-3 py-2 text-[11px] text-white/70"
            style={{ animationDelay: "0.1s" }}
          >
            今天过得怎么样？
          </div>
          <div
            className="demo-bubble self-end max-w-[75%] rounded-2xl rounded-br-md bg-gradient-to-r from-blue-500/40 to-violet-500/40 px-3 py-2 text-[11px] text-white/90"
            style={{ animationDelay: "0.35s" }}
          >
            还不错～随便聊聊呗
          </div>
          <div
            className="demo-bubble self-start max-w-[60%] rounded-2xl rounded-bl-md bg-white/8 px-3 py-1.5 text-[10px] text-white/50"
            style={{ animationDelay: "0.6s" }}
          >
            正在输入…
          </div>
        </div>
      );

    case "music-convert":
      return (
        <div className={`${stage} gap-1 px-6`}>
          {[0.4, 0.7, 1, 0.6, 0.85, 0.5, 0.9, 0.65].map((h, i) => (
            <div
              key={i}
              className="demo-bar w-2 rounded-full bg-gradient-to-t from-blue-600 to-violet-400"
              style={{
                height: `${h * 48}px`,
                animationDelay: `${i * 0.08}s`,
              }}
            />
          ))}
        </div>
      );

    case "video-extract":
      return (
        <div className={`${stage} relative`}>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <span className="absolute inset-0 rounded-full border border-blue-400/50 demo-pulse" />
              <span
                className="absolute inset-0 rounded-full border border-violet-400/30 demo-pulse"
                style={{ animationDelay: "0.6s" }}
              />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur-md">
                <svg className="h-6 w-6 text-white/90 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="absolute bottom-3 left-3 right-3 h-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-blue-500 to-violet-500 animate-pulse" />
          </div>
        </div>
      );

    case "image-studio":
      return (
        <div className={`${stage} flex-col gap-2 p-3`}>
          <div className="flex gap-1.5 w-full justify-center">
            {["压缩", "清晰", "抠图", "生图"].map((label, i) => (
              <span
                key={label}
                className={`rounded-md px-1.5 py-0.5 text-[8px] ${
                  i === 3
                    ? "bg-violet-500/30 text-violet-200 ring-1 ring-violet-400/40"
                    : "bg-white/10 text-white/45"
                }`}
              >
                {label}
              </span>
            ))}
          </div>
          <div className="demo-scan relative grid grid-cols-2 gap-2 flex-1 w-full">
            <div className="rounded-lg bg-white/5 flex items-center justify-center text-[9px] text-white/30 blur-[1px]">
              Before
            </div>
            <div className="rounded-lg bg-gradient-to-br from-sky-500/20 to-violet-500/25 flex items-center justify-center text-[9px] text-white/80 ring-1 ring-white/20">
              After
            </div>
          </div>
        </div>
      );

    case "hot-trends":
      return (
        <div className={`${stage} p-3 flex-col gap-1.5 items-stretch`}>
          {["# 春日穿搭", "# 治愈料理", "# AI 工具"].map((t, i) => (
            <div
              key={t}
              className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5"
              style={{ opacity: 1 - i * 0.2 }}
            >
              <span className="text-[10px] font-bold text-amber-400/90">{i + 1}</span>
              <span className="text-[10px] text-white/60 truncate">{t}</span>
            </div>
          ))}
        </div>
      );

    case "media-search":
      return (
        <div className={`${stage} gap-2 p-3`}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-2 w-full max-w-[140px]">
              <div className="h-8 w-6 shrink-0 rounded bg-gradient-to-br from-blue-600/40 to-indigo-600/30" />
              <div className="flex-1 space-y-1 py-0.5">
                <div className="h-1.5 rounded bg-white/20 w-full" />
                <div className="h-1 rounded bg-white/10 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      );

    case "assets":
      return (
        <div className={`${stage} p-4 flex-col gap-2`}>
          <div className="grid grid-cols-3 gap-1.5 w-full max-w-[160px]">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="aspect-square rounded-md bg-gradient-to-br from-rose-500/20 to-violet-500/20 ring-1 ring-white/10"
              />
            ))}
          </div>
          <p className="text-[9px] text-white/30">🔒 密码保护</p>
        </div>
      );

    case "subtitle-workshop":
      return (
        <div className={`${stage} p-3 flex-col gap-1.5 w-full max-w-[160px]`}>
          <div className="text-[9px] text-cyan-300/80 font-mono">00:00:01 → 00:00:04</div>
          <div className="h-1 w-full rounded bg-white/10 overflow-hidden">
            <div className="h-full w-3/4 bg-gradient-to-r from-cyan-500 to-teal-500" />
          </div>
          <p className="text-[10px] text-white/50">示例字幕文本…</p>
        </div>
      );

    case "gif-maker":
      return (
        <div className={`${stage} gap-1 px-4`}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-10 h-8 rounded bg-gradient-to-br from-amber-500/30 to-orange-500/20 ring-1 ring-white/10"
              style={{ opacity: 0.4 + i * 0.15 }}
            />
          ))}
        </div>
      );

    case "text-toolbox":
      return (
        <div className={`${stage} p-3 flex-col gap-1 w-full max-w-[140px] font-mono text-[9px] text-white/45`}>
          <div className="text-emerald-400/80">{"{ \"ok\": true }"}</div>
          <div className="text-white/30">chars: 128 · lines: 6</div>
        </div>
      );

    case "doc-convert":
      return (
        <div className={`${stage} p-4 flex-col gap-2 w-full max-w-[200px]`}>
          {["PDF", "DOC", "PNG"].map((label, i) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-lg bg-white/[0.06] px-3 py-2 text-[10px] text-white/55 ring-1 ring-white/10"
              style={{ animationDelay: `${i * 0.15}s` }}
            >
              <span>{label}</span>
              <span className="text-white/30">→</span>
              <span className="text-violet-200/70">
                {label === "PDF" ? "DOC" : label === "DOC" ? "PDF" : "PDF"}
              </span>
            </div>
          ))}
        </div>
      );

    case "spider-builder":
      return (
        <div className={`${stage} relative`}>
          <svg className="absolute inset-0 w-full h-full opacity-60" viewBox="0 0 120 80">
            <circle cx="60" cy="40" r="4" fill="#818cf8" />
            {[0, 60, 120, 180, 240, 300].map((deg, i) => {
              const x = 60 + 35 * Math.cos((deg * Math.PI) / 180);
              const y = 40 + 25 * Math.sin((deg * Math.PI) / 180);
              return (
                <g key={i}>
                  <line x1="60" y1="40" x2={x} y2={y} stroke="rgba(96,165,250,0.35)" strokeWidth="1" />
                  <circle cx={x} cy={y} r="3" fill="rgba(167,139,250,0.6)" />
                </g>
              );
            })}
          </svg>
        </div>
      );

    default:
      return (
        <div className={`${stage}`}>
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 opacity-60" />
        </div>
      );
  }
}
