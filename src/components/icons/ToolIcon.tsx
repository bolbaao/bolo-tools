"use client";

import { useId, type ReactNode } from "react";

type IconProps = {
  gradId: string;
};

const stroke = {
  fill: "none" as const,
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function GradDefs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#a5c4ff" />
        <stop offset="50%" stopColor="#c4b5fd" />
        <stop offset="100%" stopColor="#e9d5ff" stopOpacity="0.9" />
      </linearGradient>
    </defs>
  );
}

function MusicConvertIcon({ gradId }: IconProps) {
  const g = `url(#${gradId})`;
  return (
    <>
      <ellipse cx="7.5" cy="16" rx="2" ry="1.6" {...stroke} stroke={g} />
      <path d="M9.5 16V8.5l5.5-1.5v7.5" {...stroke} stroke={g} />
      <path d="M15 14.5a2 2 0 1 1-2-2" {...stroke} stroke={g} />
      <path d="M4 13.5v3M5.5 12.5v3M7 13.5v3" {...stroke} stroke={g} strokeWidth={1.25} />
      <path d="M17.5 10.5h2.5M19.25 9v3" {...stroke} stroke={g} />
      <path d="M16.5 14.5h4M18.5 13v3" {...stroke} stroke={g} />
    </>
  );
}

function VideoExtractIcon({ gradId }: IconProps) {
  const g = `url(#${gradId})`;
  return (
    <>
      <rect x="3.5" y="6" width="11" height="12" rx="2.5" {...stroke} stroke={g} />
      <path d="M8 10.5l4 2.5-4 2.5V10.5z" {...stroke} stroke={g} strokeWidth={1.25} />
      <path
        d="M17.5 8.5a2.5 2.5 0 0 1 0 3.5M17.5 12a2.5 2.5 0 0 1 0 3.5"
        {...stroke}
        stroke={g}
      />
      <path d="M17.5 8.5v7" {...stroke} stroke={g} strokeWidth={1.25} />
    </>
  );
}

function ImageStudioIcon({ gradId }: IconProps) {
  const g = `url(#${gradId})`;
  return (
    <>
      <rect x="3.5" y="6" width="10.5" height="10.5" rx="2" {...stroke} stroke={g} />
      <path d="M6.5 13l1.8-1.8 1.7 1.7 2.3-2.8 2.2 2.9" {...stroke} stroke={g} strokeWidth={1.25} />
      <path d="M6.2 12.2l.9-.9.9.9M9.1 14.1l.7-.7.7.7" {...stroke} stroke={g} strokeWidth={1.1} />
      <path d="M16.5 5.5l2.5 2.5" {...stroke} stroke={g} />
      <path d="M18.5 5.5l-2 2 1 1 2-2z" {...stroke} stroke={g} strokeWidth={1.25} />
    </>
  );
}

/** 相片轮廓 + 右下角视觉星标，用于对话上传/识别图片 */
function ImageVisionIconGfx({ gradId }: IconProps) {
  const g = `url(#${gradId})`;
  return (
    <>
      <rect x="4" y="7" width="10" height="8" rx="1.75" {...stroke} stroke={g} />
      <circle cx="6.75" cy="9.75" r="0.85" fill={g} stroke="none" />
      <path d="M5.5 12.5l1.8-1.3 1.6 1.1 2.2-1.7 2.4 1.9" {...stroke} stroke={g} strokeWidth={1.25} />
      <path d="M16.75 14.75l2.25 2.25" {...stroke} stroke={g} />
      <path d="M19 14.75l-1.5 1.5.75.75 1.5-1.5" {...stroke} stroke={g} strokeWidth={1.2} />
    </>
  );
}

function DocConvertIcon({ gradId }: IconProps) {
  const g = `url(#${gradId})`;
  return (
    <>
      <path d="M5 4.5h7l3 3v12.5H5V4.5z" {...stroke} stroke={g} />
      <path d="M12 4.5v3h3" {...stroke} stroke={g} />
      <path d="M8 11h5M8 13.5h4" {...stroke} stroke={g} strokeWidth={1.25} />
      <path d="M16.5 10.5h3M18 9v3" {...stroke} stroke={g} />
      <path d="M16 14.5h4.5M18.25 13v3" {...stroke} stroke={g} />
    </>
  );
}

function HotTrendsIcon({ gradId }: IconProps) {
  const g = `url(#${gradId})`;
  return (
    <>
      <circle cx="8.5" cy="8.5" r="4.5" {...stroke} stroke={g} />
      <circle cx="8.5" cy="8.5" r="1.5" {...stroke} stroke={g} />
      <path d="M14.5 16.5l2.5-4 2 1.5 3-5.5" {...stroke} stroke={g} />
      <path d="M19 8.5v3.5h-3.5" {...stroke} stroke={g} strokeWidth={1.25} />
    </>
  );
}

function ToolkitIcon({ gradId }: IconProps) {
  const g = `url(#${gradId})`;
  return (
    <>
      <path d="M6 9.5h12v9H6V9.5z" {...stroke} stroke={g} />
      <path d="M9 9.5V7.5a3 3 0 0 1 6 0v2" {...stroke} stroke={g} />
      <path d="M8.5 13h7M8.5 15.5h5.5" {...stroke} stroke={g} strokeWidth={1.25} />
      <path d="M4 12.5h2M18 12.5h2" {...stroke} stroke={g} strokeWidth={1.25} />
    </>
  );
}

function AiSearchIcon({ gradId }: IconProps) {
  const g = `url(#${gradId})`;
  return (
    <>
      <circle cx="11" cy="11" r="7" {...stroke} stroke={g} />
      <path d="M16 16l4.5 4.5" {...stroke} stroke={g} />
      <path d="M8 11h6M11 8v6" {...stroke} stroke={g} strokeWidth={1.25} />
      <path d="M14.5 7.5l1.5-1.5M14.5 7.5l1 2" {...stroke} stroke={g} strokeWidth={1.1} />
    </>
  );
}

function AiChatIcon({ gradId }: IconProps) {
  const g = `url(#${gradId})`;
  return (
    <>
      <path d="M5 6.5h11a2 2 0 0 1 2 2v4.5a2 2 0 0 1-2 2H10l-3.5 2.5V15H5a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2z" {...stroke} stroke={g} />
      <circle cx="9" cy="11" r="0.75" fill={g} stroke="none" />
      <circle cx="12" cy="11" r="0.75" fill={g} stroke="none" />
      <circle cx="15" cy="11" r="0.75" fill={g} stroke="none" />
    </>
  );
}

function MediaSearchIcon({ gradId }: IconProps) {
  const g = `url(#${gradId})`;
  return (
    <>
      <rect x="4" y="6" width="13" height="10" rx="1.5" {...stroke} stroke={g} />
      <path d="M4 9.5h13" {...stroke} stroke={g} strokeWidth={1.25} />
      <circle cx="15.5" cy="15.5" r="3" {...stroke} stroke={g} />
      <path d="M17.5 17.5l2 2" {...stroke} stroke={g} />
    </>
  );
}

function MediaDownloadIcon({ gradId }: IconProps) {
  const g = `url(#${gradId})`;
  return (
    <>
      <path d="M12 4.5v8" {...stroke} stroke={g} />
      <path d="M9 10.5l3 3 3-3" {...stroke} stroke={g} />
      <path d="M6 16.5h12" {...stroke} stroke={g} />
      <rect x="5" y="18" width="14" height="2.5" rx="1" {...stroke} stroke={g} strokeWidth={1.25} />
    </>
  );
}

function SpiderBuilderIcon({ gradId }: IconProps) {
  const g = `url(#${gradId})`;
  return (
    <>
      <circle cx="12" cy="12" r="2" {...stroke} stroke={g} />
      <path d="M12 4v3M12 17v3M4 12h3M17 12h3" {...stroke} stroke={g} strokeWidth={1.25} />
      <path d="M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M17.7 6.3l-2.1 2.1M8.4 15.6l-2.1 2.1" {...stroke} stroke={g} strokeWidth={1.25} />
    </>
  );
}

function SubtitleWorkshopIcon({ gradId }: IconProps) {
  const g = `url(#${gradId})`;
  return (
    <>
      <rect x="4" y="5" width="16" height="11" rx="2" {...stroke} stroke={g} />
      <path d="M7 14.5h10M8.5 11.5h7" {...stroke} stroke={g} strokeWidth={1.25} />
      <path d="M4 18.5h16" {...stroke} stroke={g} strokeWidth={1.25} />
      <path d="M6 18.5v1.5M10 18.5v1.5M14 18.5v1.5M18 18.5v1.5" {...stroke} stroke={g} strokeWidth={1.1} />
    </>
  );
}

function GifMakerIcon({ gradId }: IconProps) {
  const g = `url(#${gradId})`;
  return (
    <>
      <rect x="4" y="6" width="7" height="9" rx="1.5" {...stroke} stroke={g} />
      <rect x="9" y="8" width="7" height="9" rx="1.5" {...stroke} stroke={g} />
      <rect x="14" y="10" width="6" height="8" rx="1.5" {...stroke} stroke={g} />
      <path d="M16.5 13.5l1.5 1-1.5 1V13.5z" {...stroke} stroke={g} strokeWidth={1.1} />
    </>
  );
}

function TextToolboxIcon({ gradId }: IconProps) {
  const g = `url(#${gradId})`;
  return (
    <>
      <path d="M6 5.5h8M8 5.5V18.5" {...stroke} stroke={g} />
      <path d="M13 8.5h5M13 12h4M13 15.5h5" {...stroke} stroke={g} strokeWidth={1.25} />
      <path d="M6 18.5h6" {...stroke} stroke={g} strokeWidth={1.25} />
    </>
  );
}

function DefaultIcon({ gradId }: IconProps) {
  const g = `url(#${gradId})`;
  return (
    <>
      <rect x="5" y="5" width="14" height="14" rx="3" {...stroke} stroke={g} />
      <path d="M9 12h6M12 9v6" {...stroke} stroke={g} />
    </>
  );
}

const ICONS: Record<string, (props: IconProps) => ReactNode> = {
  "music-convert": MusicConvertIcon,
  "video-extract": VideoExtractIcon,
  "image-studio": ImageStudioIcon,
  "doc-convert": DocConvertIcon,
  "hot-trends": HotTrendsIcon,
  toolkit: ToolkitIcon,
  "ai-chat": AiChatIcon,
  "ai-search": AiSearchIcon,
  "media-search": MediaSearchIcon,
  "media-download": MediaDownloadIcon,
  "spider-builder": SpiderBuilderIcon,
  "subtitle-workshop": SubtitleWorkshopIcon,
  "gif-maker": GifMakerIcon,
  "text-toolbox": TextToolboxIcon,
};

type ToolIconProps = {
  id: string;
  className?: string;
};

export function ToolIcon({ id, className = "h-6 w-6" }: ToolIconProps) {
  const gradId = useId();
  const Icon = ICONS[id] ?? DefaultIcon;

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <GradDefs id={gradId} />
      <Icon gradId={gradId} />
    </svg>
  );
}

type ImageVisionIconProps = {
  className?: string;
};

export function ImageVisionIcon({ className = "h-5 w-5" }: ImageVisionIconProps) {
  const gradId = useId();
  return (
    <svg
      className={`${className} tool-icon-glow`.trim()}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <GradDefs id={gradId} />
      <ImageVisionIconGfx gradId={gradId} />
    </svg>
  );
}

export type ToolIconSize = "sm" | "md" | "lg";

const BOX_SIZE: Record<ToolIconSize, string> = {
  sm: "tool-icon-box tool-icon-box-sm",
  md: "tool-icon-box tool-icon-box-md",
  lg: "tool-icon-box tool-icon-box-lg",
};

const ICON_SIZE: Record<ToolIconSize, string> = {
  sm: "h-[22px] w-[22px]",
  md: "h-6 w-6",
  lg: "h-7 w-7",
};

type ToolIconBoxProps = {
  id: string;
  size?: ToolIconSize;
  className?: string;
};

export function ToolIconBox({ id, size = "md", className = "" }: ToolIconBoxProps) {
  return (
    <span className={`${BOX_SIZE[size]} ${className}`.trim()}>
      <ToolIcon id={id} className={`${ICON_SIZE[size]} tool-icon-glow`} />
    </span>
  );
}
