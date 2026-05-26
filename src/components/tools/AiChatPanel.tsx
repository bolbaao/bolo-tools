"use client";

import { ApiError, apiPost } from "@/lib/api";
import { useState } from "react";

const welcomeMessage = "嗨～我是你的闲聊搭子。想聊什么都可以，不用正经，随便唠。";

export default function AiChatPanel() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: welcomeMessage },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    const nextMessages = [...messages, { role: "user" as const, text: userMsg }];
    setMessages(nextMessages);
    setLoading(true);
    setError(null);

    try {
      const apiMessages = nextMessages
        .filter(
          (m) =>
            m.role === "user" ||
            (m.role === "ai" && m.text !== welcomeMessage && !m.text.startsWith("（出错了）")),
        )
        .slice(-12)
        .map((m) => ({
          role: m.role === "user" ? ("user" as const) : ("assistant" as const),
          content: m.text,
        }));

      if (apiMessages.length === 0 || !apiMessages.some((m) => m.role === "user")) {
        throw new Error("消息为空");
      }

      const data = await apiPost<{ ok: boolean; reply: string }>(
        "/api/chat",
        { messages: apiMessages },
        { timeoutMs: 65000 },
      );

      setMessages((m) => [...m, { role: "ai", text: data.reply }]);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "发送失败";
      setError(msg);
      setMessages((m) => [...m, { role: "ai", text: `（出错了）${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([{ role: "ai", text: welcomeMessage }]);
    setInput("");
    setError(null);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/45 leading-relaxed">
        已接入火山方舟。请在 <code className="text-violet-300/80">.env</code> 配置{" "}
        <code className="text-violet-300/80">ARK_API_KEY</code>、{" "}
        <code className="text-violet-300/80">ARK_MODEL</code>（见{" "}
        <a
          href="https://console.volcengine.com/ark"
          target="_blank"
          rel="noopener noreferrer"
          className="text-violet-300/80 hover:underline"
        >
          火山方舟控制台
        </a>
        ）。
      </p>

      <div className="rounded-xl border border-white/8 bg-black/20 flex flex-col h-[360px] sm:h-[420px]">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
          <span className="text-xs text-white/40">闲聊中</span>
          <button
            type="button"
            onClick={clearChat}
            className="text-xs text-white/35 hover:text-white/60 transition-colors"
          >
            清空对话
          </button>
        </div>

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
            <p className="text-xs text-white/30 animate-pulse">对方正在输入…</p>
          )}
        </div>

        <div className="border-t border-white/8 p-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void send()}
            placeholder="随便聊点什么…"
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-violet-500/50"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={loading || !input.trim()}
            className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            发送
          </button>
        </div>
      </div>

      {error && <p className="text-center text-xs text-red-400/80">{error}</p>}
    </div>
  );
}
