"use client";

import Link from "next/link";
import { ApiError, apiGet } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

type NavPortal = { id: string; label: string; url: string };
type NavExtraLink = { id: string; label: string; url: string };

type MediaNavResponse = {
  ok: boolean;
  title: string;
  notices: string[];
  portals: NavPortal[];
  extras: { title: string; links: NavExtraLink[] } | null;
  internal: { label: string; href: string; hint: string };
};

export default function MediaSearchPanel() {
  const [nav, setNav] = useState<MediaNavResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNav = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<MediaNavResponse>("/api/media/nav");
      setNav(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载导航失败");
      setNav(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNav();
  }, [loadNav]);

  if (loading) {
    return <p className="text-center text-sm text-white/40 py-16">正在加载导航…</p>;
  }

  if (error || !nav) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-red-400/90">{error || "导航不可用"}</p>
        <button
          type="button"
          onClick={() => void loadNav()}
          className="text-sm text-indigo-300 hover:text-indigo-200"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-2 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
        {nav.notices.map((line) => (
          <p key={line} className="text-sm text-amber-100/90 leading-relaxed">
            ⚠️{line}
          </p>
        ))}
      </div>

      <div className="space-y-1">
        <h2 className="text-center text-lg font-semibold text-white/90 tracking-wide">
          {nav.title}
        </h2>
        <ul className="space-y-3 pt-2">
          {nav.portals.map((item) => (
            <li key={item.id}>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl px-2 py-2 text-center text-lg font-semibold text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 transition-colors"
              >
                👉{item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <hr className="border-white/10" />

      {nav.extras ? (
        <div className="space-y-3">
          <p className="text-center text-sm font-medium text-white/70">{nav.extras.title}</p>
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-sm">
            {nav.extras.links.map((link, i) => (
              <span key={link.id} className="inline-flex items-center gap-2">
                {i > 0 ? <span className="text-white/25">·</span> : null}
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-sky-400 hover:text-sky-300"
                >
                  👉{link.label}
                </a>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <hr className="border-white/10" />

      <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-4 text-center">
        <p className="text-xs text-white/40 mb-2">{nav.internal.hint}</p>
        <Link
          href={nav.internal.href}
          className="inline-block text-base font-semibold text-indigo-300 hover:text-indigo-200"
        >
          👉{nav.internal.label}
        </Link>
      </div>

      <p className="text-center text-[11px] text-white/25 leading-relaxed">
        外部链接跳转至第三方页面，请自行甄别内容。布局参考
        <a
          href="https://sdocapp.com/s/JCuSjA3k5zzjjvQN9"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/35 underline underline-offset-2 ml-1"
        >
          群公告导航
        </a>
        。
      </p>
    </div>
  );
}
