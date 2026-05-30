"use client";

import ActionButton from "@/components/ActionButton";
import { ApiError, apiPost } from "@/lib/api";
import { useState } from "react";

const MAX_MESSAGE_LEN = 2000;

export default function FeedbackForm() {
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorText, setErrorText] = useState("");

  async function handleSubmit() {
    const text = message.trim();
    if (text.length < 5) {
      setStatus("error");
      setErrorText("请至少输入 5 个字的反馈内容");
      return;
    }

    setLoading(true);
    setStatus("idle");
    setErrorText("");

    try {
      await apiPost<{ ok: boolean }>("/api/feedback", {
        message: text,
        contact: contact.trim() || undefined,
      });
      setMessage("");
      setContact("");
      setStatus("success");
    } catch (e) {
      setStatus("error");
      setErrorText(e instanceof ApiError ? e.message : "提交失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-5 space-y-4">
      <div>
        <label htmlFor="feedback-message" className="block text-xs text-white/45 mb-2">
          你的反馈
        </label>
        <textarea
          id="feedback-message"
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LEN))}
          rows={4}
          placeholder="功能建议、合作想法或使用体验…"
          className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
        />
        <p className="mt-1 text-right text-xs text-white/25">
          {message.length} / {MAX_MESSAGE_LEN}
        </p>
      </div>

      <div>
        <label htmlFor="feedback-contact" className="block text-xs text-white/45 mb-2">
          联系方式（选填）
        </label>
        <input
          id="feedback-contact"
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value.slice(0, 200))}
          placeholder="邮箱、微信等，方便回复你"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
        />
      </div>

      <ActionButton
        label="发送反馈"
        loadingLabel="发送中…"
        loading={loading}
        disabled={message.trim().length < 5}
        onClick={handleSubmit}
        className="!w-auto !px-6 !py-2.5"
      />

      {status === "success" && (
        <p className="text-sm text-emerald-400/90">感谢你的反馈，我们会认真阅读。</p>
      )}
      {status === "error" && errorText && (
        <p className="text-sm text-rose-400/90">{errorText}</p>
      )}
    </div>
  );
}
