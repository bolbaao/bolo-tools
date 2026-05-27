"use client";

import ActionButton from "@/components/ActionButton";
import {
  countTextStats,
  dedupeLines,
  formatJson,
  markdownToHtml,
} from "@/lib/text-tools";
import { useMemo, useState } from "react";

type Tab = "stats" | "dedupe" | "json" | "markdown";

const TABS: { id: Tab; label: string }[] = [
  { id: "stats", label: "字数统计" },
  { id: "dedupe", label: "去重行" },
  { id: "json", label: "JSON" },
  { id: "markdown", label: "Markdown" },
];

export default function TextToolboxForm() {
  const [tab, setTab] = useState<Tab>("stats");
  const [input, setInput] = useState("");
  const [jsonMinify, setJsonMinify] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonOut, setJsonOut] = useState("");

  const stats = useMemo(() => countTextStats(input), [input]);
  const mdHtml = useMemo(() => (tab === "markdown" ? markdownToHtml(input) : ""), [input, tab]);

  const handleDedupe = () => {
    setInput(dedupeLines(input));
  };

  const handleJson = () => {
    const r = formatJson(input, jsonMinify);
    if (r.ok) {
      setJsonOut(r.result);
      setJsonError(null);
    } else {
      setJsonError(r.error);
      setJsonOut("");
    }
  };

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/8">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 min-w-[4rem] rounded-lg px-2 py-2 text-sm transition-all ${
              tab === t.id
                ? "bg-slate-600/30 text-white border border-white/15"
                : "text-white/45 hover:bg-white/5"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={tab === "stats" ? 8 : 10}
        placeholder={
          tab === "json"
            ? '{"key": "value"}'
            : tab === "markdown"
              ? "# 标题\n\n**粗体** 与 `代码`"
              : "粘贴或输入文本…"
        }
        className="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-slate-500/50 focus:outline-none focus:ring-1 focus:ring-slate-500/30 font-mono"
      />

      {tab === "stats" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "字符", value: stats.chars },
            { label: "字符(无空格)", value: stats.charsNoSpace },
            { label: "词/字块", value: stats.words },
            { label: "行数", value: stats.lines },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-white/8 bg-white/[0.02] p-3 text-center">
              <p className="text-xs text-white/40">{item.label}</p>
              <p className="mt-1 text-lg font-semibold text-white/90">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "dedupe" && (
        <ActionButton label="去除重复行" disabled={!input.trim()} onClick={handleDedupe} />
      )}

      {tab === "json" && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-white/50">
            <input
              type="checkbox"
              checked={jsonMinify}
              onChange={(e) => setJsonMinify(e.target.checked)}
              className="rounded border-white/20"
            />
            压缩为一行
          </label>
          <ActionButton label="格式化 JSON" disabled={!input.trim()} onClick={handleJson} />
          {jsonError && <p className="text-sm text-red-400/90">{jsonError}</p>}
          {jsonOut && (
            <div className="space-y-2">
              <pre className="max-h-48 overflow-auto rounded-xl border border-white/8 bg-black/30 p-3 text-xs text-white/80">
                {jsonOut}
              </pre>
              <button
                type="button"
                onClick={() => copyText(jsonOut)}
                className="text-xs text-blue-300/80 hover:text-blue-200 underline-offset-2 hover:underline"
              >
                复制结果
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "markdown" && input.trim() && (
        <div
          className="rounded-xl border border-white/8 bg-white/[0.02] p-4 prose-invert text-sm text-white/80 [&_.md-h]:font-semibold [&_.md-h]:text-white [&_h1]:text-xl [&_h2]:text-lg [&_.md-code]:bg-black/40 [&_.md-code]:p-3 [&_.md-code]:rounded-lg [&_.md-ul]:list-disc [&_.md-ul]:pl-5"
          dangerouslySetInnerHTML={{ __html: mdHtml }}
        />
      )}

      <p className="text-center text-xs text-white/25">纯浏览器本地处理，文本不会上传</p>
    </div>
  );
}
