"use client";

import MockButton from "@/components/MockButton";
import { useState } from "react";

export default function VideoExtractForm() {
  const [url, setUrl] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="video-url" className="block text-sm text-white/60 mb-2">
          视频链接
        </label>
        <input
          id="video-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="粘贴视频页面链接…"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
        />
      </div>

      <div className="rounded-xl bg-white/[0.02] border border-white/8 p-4">
        <p className="text-xs text-white/40 mb-3">解析预览（演示）</p>
        <div className="aspect-video rounded-lg bg-gradient-to-br from-white/5 to-white/[0.02] flex items-center justify-center">
          <span className="text-white/20 text-sm">
            {url ? "等待解析…" : "输入链接后显示预览"}
          </span>
        </div>
      </div>

      <MockButton
        label="解析并提取"
        successMessage="链接已解析，下载任务已创建（演示）"
      />
    </div>
  );
}
