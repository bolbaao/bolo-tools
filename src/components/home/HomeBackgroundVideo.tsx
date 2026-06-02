"use client";

import { useEffect, useRef } from "react";

type Props = {
  src: string;
  onError?: () => void;
};

export default function HomeBackgroundVideo({ src, onError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const play = () => {
      el.play().catch(() => {
        /* autoplay blocked */
      });
    };
    play();
    el.addEventListener("loadeddata", play);
    el.addEventListener("canplay", play);
    return () => {
      el.removeEventListener("loadeddata", play);
      el.removeEventListener("canplay", play);
    };
  }, [src]);

  return (
    <div className="home-bg-video-layer pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <video
        ref={videoRef}
        key={src}
        className="home-bg-video"
        src={src}
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
        onError={() => onError?.()}
      />
      <div className="home-bg-video-overlay pointer-events-none absolute inset-0" />
    </div>
  );
}
