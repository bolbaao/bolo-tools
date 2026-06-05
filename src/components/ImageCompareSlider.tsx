"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ImageCompareSliderProps = {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
};

export default function ImageCompareSlider({
  beforeSrc,
  afterSrc,
  beforeLabel = "原图",
  afterLabel = "处理后",
  className = "",
}: ImageCompareSliderProps) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updatePosition = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    setPosition(pct);
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      updatePosition(e.clientX);
    };
    const onUp = () => {
      dragging.current = false;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [updatePosition]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    updatePosition(e.clientX);
  };

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-xl border border-white/10 bg-black/30 aspect-[4/3] max-h-80 select-none touch-none"
        onPointerDown={onPointerDown}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={afterSrc}
          alt={afterLabel}
          className="absolute inset-0 h-full w-full object-contain"
          draggable={false}
        />
        <div
          className="absolute inset-y-0 left-0 overflow-hidden"
          style={{ width: `${position}%` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={beforeSrc}
            alt={beforeLabel}
            className="absolute inset-0 h-full max-w-none object-contain"
            style={{ width: containerRef.current?.offsetWidth ?? "100%" }}
            draggable={false}
          />
        </div>
        <div
          className="absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_8px_rgba(0,0,0,0.5)]"
          style={{ left: `${position}%` }}
        >
          <div className="absolute top-1/2 left-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-black/50 text-white/90 shadow-lg">
            <span className="text-[10px] tracking-tighter">◀▶</span>
          </div>
        </div>
        <span className="absolute left-2 top-2 rounded-md bg-black/50 px-2 py-0.5 text-[10px] text-white/70">
          {beforeLabel}
        </span>
        <span className="absolute right-2 top-2 rounded-md bg-black/50 px-2 py-0.5 text-[10px] text-white/70">
          {afterLabel}
        </span>
      </div>
      <p className="mt-2 text-center text-[11px] text-white/30">拖动滑块对比前后效果</p>
    </div>
  );
}
