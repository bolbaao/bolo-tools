"use client";

import { useState } from "react";

type Platform = "douyin" | "xiaohongshu";

const trends: Record<Platform, { rank: number; title: string; heat: string; tag: string }[]> = {
  douyin: [
    { rank: 1, title: "#春日氛围感穿搭", heat: "1286万", tag: "时尚" },
    { rank: 2, title: "#一人食治愈料理", heat: "982万", tag: "美食" },
    { rank: 3, title: "#居家健身跟练", heat: "876万", tag: "运动" },
    { rank: 4, title: "#职场高效技巧", heat: "754万", tag: "职场" },
    { rank: 5, title: "#旅行vlog拍摄", heat: "691万", tag: "旅行" },
    { rank: 6, title: "#AI工具实测", heat: "623万", tag: "科技" },
  ],
  xiaohongshu: [
    { rank: 1, title: "早八通勤伪素颜妆", heat: "52.3万笔记", tag: "美妆" },
    { rank: 2, title: "租房改造低成本", heat: "41.8万笔记", tag: "家居" },
    { rank: 3, title: "减脂便当一周食谱", heat: "38.6万笔记", tag: "健康" },
    { rank: 4, title: "副业自媒体起号", heat: "35.2万笔记", tag: "成长" },
    { rank: 5, title: "周末城市微度假", heat: "31.7万笔记", tag: "旅行" },
    { rank: 6, title: "数码好物清单", heat: "28.9万笔记", tag: "数码" },
  ],
};

const platforms: { id: Platform; label: string; color: string }[] = [
  { id: "douyin", label: "抖音", color: "from-gray-800 to-gray-900 border-white/15" },
  { id: "xiaohongshu", label: "小红书", color: "from-red-600/30 to-rose-600/20 border-red-500/35" },
];

export default function HotTrendsPanel() {
  const [platform, setPlatform] = useState<Platform>("douyin");
  const [copied, setCopied] = useState<number | null>(null);

  const list = trends[platform];

  const copyTopic = (rank: number, title: string) => {
    navigator.clipboard?.writeText(title).catch(() => {});
    setCopied(rank);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {platforms.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPlatform(p.id)}
            className={`flex-1 rounded-xl py-3 text-sm font-medium border transition-all bg-gradient-to-br ${
              platform === p.id
                ? `${p.color} text-white shadow-lg`
                : "bg-white/5 border-white/8 text-white/50 hover:bg-white/10"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-white/40">
        <span>今日热点榜 · 演示数据</span>
        <span className="text-white/25">更新于 {new Date().toLocaleDateString("zh-CN")}</span>
      </div>

      <ul className="space-y-2">
        {list.map((item) => (
          <li
            key={item.rank}
            className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3.5 hover:bg-white/[0.04] transition-colors group"
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                item.rank <= 3
                  ? "bg-gradient-to-br from-amber-500/40 to-orange-600/30 text-amber-200"
                  : "bg-white/8 text-white/50"
              }`}
            >
              {item.rank}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white/90 truncate">{item.title}</p>
              <p className="text-xs text-white/35 mt-0.5">
                {item.heat} · {item.tag}
              </p>
            </div>
            <button
              type="button"
              onClick={() => copyTopic(item.rank, item.title)}
              className="shrink-0 rounded-lg px-3 py-1 text-xs border border-white/10 text-white/50 hover:text-violet-300 hover:border-violet-500/30 transition-colors"
            >
              {copied === item.rank ? "已复制" : "复制"}
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="w-full rounded-xl border border-dashed border-orange-500/30 bg-orange-500/10 py-3 text-sm text-orange-200/90 hover:bg-orange-500/15 transition-colors"
      >
        刷新热点（演示）
      </button>
    </div>
  );
}
