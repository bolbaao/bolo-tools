type Props = {
  className?: string;
  size?: number;
};

/** 无文字的菠萝标识 — 用于导航与品牌点缀 */
export default function PineappleMark({ className = "", size = 36 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="pm-body" x1="12" y1="8" x2="28" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fcd34d" />
          <stop offset="0.45" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id="pm-leaf" x1="8" y1="4" x2="32" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="#86efac" />
          <stop offset="1" stopColor="#22c55e" />
        </linearGradient>
        <linearGradient id="pm-shine" x1="14" y1="12" x2="22" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id="pm-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#pm-glow)">
        <path
          d="M20 6c-1.2 2.8-3.4 4.2-6 4.8 1.8 0.3 3.2 1 4.2 2.2-2.8 0.6-4.8 2.2-6 4.8 1.4-3.6 4-5.4 7.8-5.4s6.4 1.8 7.8 5.4c-1.2-2.6-3.2-4.2-6-4.8 1-1.2 2.4-1.9 4.2-2.2-2.6-0.6-4.8-2-6-4.8z"
          fill="url(#pm-leaf)"
          opacity="0.95"
        />
        <ellipse cx="20" cy="24" rx="9.5" ry="11" fill="url(#pm-body)" />
        <ellipse cx="20" cy="24" rx="9.5" ry="11" stroke="rgba(255,255,255,0.12)" strokeWidth="0.6" />
        <path
          d="M15 19c0-1.2 1-2 2.2-2s2.2 0.8 2.2 2-1 2-2.2 2-2.2-0.8-2.2-2zm5.6 0c0-1.2 1-2 2.2-2s2.2 0.8 2.2 2-1 2-2.2 2-2.2-0.8-2.2-2zm-2.8 5.2c-2 0-3.6 0.8-3.6 1.8s1.6 1.8 3.6 1.8 3.6-0.8 3.6-1.8-1.6-1.8-3.6-1.8z"
          fill="rgba(180,83,9,0.35)"
        />
        <path
          d="M14 16c1.2-2 3-3 6-3s4.8 1 6 3"
          stroke="url(#pm-shine)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
