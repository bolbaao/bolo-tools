"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getToolDemoSource } from "@/lib/tool-demos";
import ToolDemoVisualFallback from "@/components/home/ToolDemoVisualFallback";

type Props = {
  toolId: string;
  large?: boolean;
};

export default function ToolDemoVideo({ toolId, large }: Props) {
  const source = getToolDemoSource(toolId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const stage = `demo-stage demo-stage-video ${large ? "demo-stage-lg" : ""}`;

  const tryPlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.play().catch(() => {
      /* autoplay blocked — poster still visible */
    });
  }, []);

  useEffect(() => {
    if (!source) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setSrc(source.localPath);

    let cancelled = false;
    fetch(source.localPath, { method: "HEAD" })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setSrc(source.localPath);
        } else {
          setSrc(source.remoteUrl);
        }
      })
      .catch(() => {
        if (!cancelled) setSrc(source.remoteUrl);
      });

    return () => {
      cancelled = true;
    };
  }, [source]);

  if (!source || failed) {
    return <ToolDemoVisualFallback toolId={toolId} large={large} />;
  }

  if (!src) {
    return (
      <div className={`${stage} flex items-center justify-center`}>
        {source.poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={source.poster}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-60"
          />
        ) : null}
        <div className="h-6 w-6 animate-pulse rounded-full bg-white/20" />
      </div>
    );
  }

  return (
    <div className={stage}>
      <video
        ref={videoRef}
        key={src}
        className="demo-video"
        src={src}
        poster={source.poster}
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
        onLoadedData={tryPlay}
        onCanPlay={tryPlay}
        onError={() => {
          if (src === source.localPath) {
            setSrc(source.remoteUrl);
            return;
          }
          setFailed(true);
        }}
      />
      <div className="demo-video-vignette pointer-events-none" aria-hidden />
    </div>
  );
}
