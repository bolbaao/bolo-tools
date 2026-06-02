"use client";

import HomeBackgroundVideo from "@/components/home/HomeBackgroundVideo";
import ParticleDiffusionBackground from "@/components/home/ParticleDiffusionBackground";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchHomeBackground,
  loadLocalHomeBackground,
} from "@/lib/home-background";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function HomeBackground() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const { user, loading: authLoading } = useAuth();
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  const reload = useCallback(() => {
    setRev((n) => n + 1);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onUpdate = () => reload();
    window.addEventListener("home-background-updated", onUpdate);
    return () => window.removeEventListener("home-background-updated", onUpdate);
  }, [reload]);

  useEffect(() => {
    if (!isHome) {
      setVideoSrc(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    const load = async () => {
      if (authLoading) return;

      if (user) {
        try {
          const info = await fetchHomeBackground();
          if (cancelled) return;
          if (info.configured && info.videoUrl) {
            const url = `${info.videoUrl}?v=${rev || Date.now()}`;
            setVideoSrc(url);
            return;
          }
        } catch {
          if (!cancelled) setVideoSrc(null);
        }
      }

      const local = await loadLocalHomeBackground();
      if (cancelled) return;
      if (local) {
        objectUrl = local;
        setVideoSrc(local);
        return;
      }
      setVideoSrc(null);
    };

    void load();

    return () => {
      cancelled = true;
      if (objectUrl?.startsWith("blob:")) URL.revokeObjectURL(objectUrl);
    };
  }, [isHome, user, authLoading, rev]);

  const handleVideoError = useCallback(() => {
    setVideoSrc(null);
  }, []);

  if (!isHome) return null;

  return (
    <>
      {videoSrc ? (
        <HomeBackgroundVideo key={videoSrc} src={videoSrc} onError={handleVideoError} />
      ) : (
        <ParticleDiffusionBackground />
      )}
    </>
  );
}

export function notifyHomeBackgroundUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("home-background-updated"));
  }
}
