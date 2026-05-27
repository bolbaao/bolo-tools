"use client";

import { executeAgentActions, formatActionResults } from "@/lib/agent-executor";
import type { ActionResult, AgentAction, AgentPageContext, AgentResponse } from "@/lib/agent-types";
import { ApiError, apiPost } from "@/lib/api";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";

const welcomeMessage =
  "嗨～想聊什么都可以，随便唠。要是想用网站上的工具，也可以直接说，比如「帮我把这个视频链接提取出来」。";

type ChatMessage = {
  role: "user" | "ai";
  text: string;
  plan?: string[];
  actionResults?: ActionResult[];
};

export default function AiChatPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "ai", text: welcomeMessage },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getPageContext = useCallback((): AgentPageContext => {
    const toolMatch = pathname?.match(/^\/tools\/([^/]+)/);
    return {
      path: pathname ?? "/",
      toolId: toolMatch?.[1],
    };
  }, [pathname]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    const nextMessages: ChatMessage[] = [...messages, { role: "user", text: userMsg }];
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

      if (!apiMessages.some((m) => m.role === "user")) {
        throw new Error("消息为空");
      }

      const data = await apiPost<AgentResponse>(
        "/api/chat",
        {
          messages: apiMessages,
          pageContext: getPageContext(),
        },
        { timeoutMs: 65000 },
      );

      let actionResults: ActionResult[] = [];
      if (data.actions?.length) {
        await new Promise((r) => setTimeout(r, 120));
        actionResults = await executeAgentActions(data.actions as AgentAction[], router);
      }

      const resultNote =
        actionResults.length > 0 ? `\n\n${formatActionResults(actionResults)}` : "";

      setMessages((m) => [
        ...m,
        {
          role: "ai",
          text: `${data.reply}${resultNote}`,
          plan: data.intent === "operate" ? data.plan : undefined,
          actionResults,
        },
      ]);
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : "发送失败";
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
        主打轻松 AI 对话；需要时也可当智能助手，帮你打开工具、预填链接或关键词。
      </p>

      <div className="rounded-xl border border-white/8 bg-black/20 flex flex-col h-[360px] sm:h-[420px]">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
          <span className="text-xs text-white/40">AI 对话</span>
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
              className={`flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              {msg.plan && msg.plan.length > 0 && (
                <div className="max-w-[90%] rounded-xl border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-xs text-white/55">
                  <p className="font-medium text-violet-300/80 mb-1">助手执行计划</p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    {msg.plan.map((step, j) => (
                      <li key={j}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
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
            <p className="text-xs text-white/30 animate-pulse">正在回复…</p>
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
