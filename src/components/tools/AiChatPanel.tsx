"use client";

import { useState } from "react";

const characters = [
  { id: "creator", name: "创作顾问", desc: "选题、脚本、标题优化", emoji: "✍️" },
  { id: "editor", name: "剪辑助手", desc: "节奏、转场、BGM 建议", emoji: "🎬" },
  { id: "ops", name: "运营达人", desc: "涨粉、互动、发布时间", emoji: "📈" },
  { id: "copy", name: "文案大神", desc: "爆款文案、金句、话题", emoji: "💬" },
];

const mockReplies: Record<string, string> = {
  creator: "这个选题很有潜力！建议开头 3 秒用悬念钩子，标题可加数字或反问句提升点击率。",
  editor: "节奏可以更快一些，每 5–8 秒切一个镜头；BGM 选轻快不抢人声的类型更合适。",
  ops: "今晚 19:00–21:00 是流量高峰，建议搭配热门 BGM 并回复前 30 条评论提升互动率。",
  copy: "给你一句参考：「普通人也能做到的 3 个技巧，第 2 个绝了」— 适合短视频封面文案。",
};

export default function AiChatPanel() {
  const [character, setCharacter] = useState(characters[0]);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: `你好，我是${characters[0].name}。有什么创作问题尽管问我～` },
  ]);
  const [loading, setLoading] = useState(false);

  const send = () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", text: userMsg }]);
    setLoading(true);
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        { role: "ai", text: mockReplies[character.id] ?? "收到！这是演示回复，正式版将接入 AI 接口。" },
      ]);
      setLoading(false);
    }, 900);
  };

  const switchCharacter = (c: (typeof characters)[0]) => {
    setCharacter(c);
    setMessages([{ role: "ai", text: `已切换为${c.name}。${c.desc}，有什么可以帮你？` }]);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {characters.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => switchCharacter(c)}
            className={`rounded-xl p-3 text-left transition-all border ${
              character.id === c.id
                ? "bg-violet-600/25 border-violet-500/40"
                : "bg-white/5 border-white/8 hover:bg-white/10"
            }`}
          >
            <span className="text-lg">{c.emoji}</span>
            <p className="text-sm font-medium text-white/90 mt-1">{c.name}</p>
            <p className="text-[10px] text-white/40 mt-0.5 line-clamp-1">{c.desc}</p>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-white/8 bg-black/20 flex flex-col h-[320px] sm:h-[380px]">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-violet-600/40 text-white"
                    : "bg-white/8 text-white/85"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <p className="text-xs text-white/30 animate-pulse">正在思考…</p>
          )}
        </div>
        <div className="border-t border-white/8 p-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={`向${character.name}提问…`}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-violet-500/50"
          />
          <button
            type="button"
            onClick={send}
            disabled={loading || !input.trim()}
            className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            发送
          </button>
        </div>
      </div>
      <p className="text-center text-xs text-white/25">演示模式 · 回复为预设示例</p>
    </div>
  );
}
