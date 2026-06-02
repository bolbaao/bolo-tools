"use client";

import ActionButton from "@/components/ActionButton";
import { useAgentPrefill } from "@/hooks/useAgentPrefill";
import { ApiError, apiGet, apiPost, downloadText } from "@/lib/api";
import { AI_SERVICE_UNAVAILABLE } from "@/lib/service-message";
import { useCallback, useEffect, useState } from "react";

type WritingMode = { id: string; label: string; hint: string };

const TONES = [
  { id: "formal", label: "正式" },
  { id: "casual", label: "轻松" },
  { id: "professional", label: "专业" },
  { id: "warm", label: "温暖" },
  { id: "persuasive", label: "说服" },
];

const LENGTHS = [
  { id: "short", label: "短" },
  { id: "medium", label: "中" },
  { id: "long", label: "长" },
];

const EXAMPLES: Record<string, string> = {
  article: "写一篇关于远程办公效率提升的短文，面向职场新人",
  rewrite: "这个产品非常好用，我每天都用，推荐给大家。",
  polish: "我觉得这个方案挺好的，但是可能还需要再考虑一下细节问题。",
  expand: "人工智能正在改变内容创作的方式。",
  summarize:
    "远程办公在过去几年快速普及。许多公司发现员工在家工作同样高效，甚至减少了通勤时间。但协作与沟通仍是挑战，需要更好的工具和流程。",
  social: "分享一款提高专注力的番茄钟 App，适合学生和自由职业者",
  email: "给合作方写一封邮件，确认下周会议时间并附上议程要点",
  translate: "The quick brown fox jumps over the lazy dog.",
};

export default function AiWriterPanel() {
  const [modes, setModes] = useState<WritingMode[]>([]);
  const [mode, setMode] = useState("article");
  const [input, setInput] = useState("");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("professional");
  const [length, setLength] = useState("medium");
  const [targetLang, setTargetLang] = useState("");
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = useCallback(
    async (overrides?: { mode?: string; input?: string; topic?: string }) => {
      const inputVal = (overrides?.input ?? input).trim();
      const modeVal = overrides?.mode ?? mode;
      const topicVal = overrides?.topic ?? topic;
      if (!inputVal) return;
      if (overrides?.mode) setMode(overrides.mode);
      if (overrides?.input) setInput(overrides.input);
      if (overrides?.topic) setTopic(overrides.topic);
      setLoading(true);
      setError(null);
      setOutput(null);
      setCopied(false);
      try {
        const data = await apiPost<{
          ok: boolean;
          text: string;
          modeLabel?: string;
          provider?: string;
        }>(
          "/api/ai-writer/generate",
          {
            mode: modeVal,
            input: inputVal,
            topic: topicVal.trim() || undefined,
            tone,
            length: modeVal === "article" || modeVal === "social" ? length : undefined,
            targetLang: modeVal === "translate" ? targetLang || undefined : undefined,
          },
          { timeoutMs: 120000 },
        );
        setOutput(data.text);
        setProvider(data.provider || null);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "生成失败");
      } finally {
        setLoading(false);
      }
    },
    [input, mode, topic, tone, length, targetLang],
  );

  useAgentPrefill("ai-writer", {
    apply: (fields) => {
      if (fields.mode) setMode(fields.mode);
      if (fields.input) setInput(fields.input);
      if (fields.topic) setTopic(fields.topic);
    },
    canSubmit: (fields) => Boolean(fields.input?.trim()),
    submit: (fields) =>
      handleGenerate({
        mode: fields.mode,
        input: fields.input,
        topic: fields.topic,
      }),
  });

  useEffect(() => {
    apiGet<{ ok: boolean; aiConfigured: boolean; modes: WritingMode[] }>(
      "/api/ai-writer/capabilities",
    )
      .then((d) => {
        setAiConfigured(d.aiConfigured);
        setModes(d.modes || []);
        if (d.modes?.[0]) setMode(d.modes[0].id);
      })
      .catch(() => setAiConfigured(false));
  }, []);

  const activeMode = modes.find((m) => m.id === mode);

  const copyOutput = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadOutput = () => {
    if (!output) return;
    downloadText(output, `ai-writer-${mode}-${Date.now()}.md`, "text/markdown;charset=utf-8");
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-indigo-500/15 bg-indigo-500/5 px-5 py-4">
        <p className="text-sm text-white/65 leading-relaxed">
          写文章、改写法、润色、扩写、写摘要、社媒文案、邮件或翻译——选好模式，输入内容，一键生成。
        </p>
      </div>

      {aiConfigured === false && (
        <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-amber-100/85">
          {AI_SERVICE_UNAVAILABLE}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/8">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              setMode(m.id);
              setError(null);
            }}
            className={`flex-1 min-w-[4.5rem] rounded-lg px-2 py-2 text-center transition-all ${
              mode === m.id
                ? "bg-indigo-600/25 text-indigo-100 border border-indigo-500/30"
                : "text-white/45 hover:text-white/70 hover:bg-white/5"
            }`}
          >
            <span className="block text-xs font-medium">{m.label}</span>
          </button>
        ))}
      </div>

      {activeMode && (
        <p className="text-xs text-white/35 -mt-2">{activeMode.hint}</p>
      )}

      {(mode === "article" || mode === "social" || mode === "email") && (
        <div>
          <label htmlFor="writer-topic" className="block text-sm text-white/60 mb-2">
            主题说明（可选）
          </label>
          <input
            id="writer-topic"
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value.slice(0, 200))}
            placeholder="补充背景、受众、场景…"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
          />
        </div>
      )}

      <div>
        <label htmlFor="writer-input" className="block text-sm text-white/60 mb-2">
          {mode === "article" || mode === "social" || mode === "email" ? "主题 / 要点" : "待处理文本"}
        </label>
        <textarea
          id="writer-input"
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, 8000))}
          rows={8}
          placeholder={EXAMPLES[mode] || "输入内容…"}
          className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
        />
        <p className="mt-1 text-right text-xs text-white/25">{input.length} / 8000</p>
      </div>

      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-sm text-white/60 mb-2">语气</label>
          <div className="flex flex-wrap gap-2">
            {TONES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTone(t.id)}
                className={`rounded-lg px-3 py-1.5 text-xs ${
                  tone === t.id
                    ? "bg-indigo-600/30 text-indigo-100 ring-1 ring-indigo-500/40"
                    : "bg-white/5 text-white/50 hover:bg-white/8"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {(mode === "article" || mode === "social") && (
          <div>
            <label className="block text-sm text-white/60 mb-2">篇幅</label>
            <div className="flex flex-wrap gap-2">
              {LENGTHS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLength(l.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs ${
                    length === l.id
                      ? "bg-indigo-600/30 text-indigo-100 ring-1 ring-indigo-500/40"
                      : "bg-white/5 text-white/50 hover:bg-white/8"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === "translate" && (
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="target-lang" className="block text-sm text-white/60 mb-2">
              目标语言（可选，留空自动中英互译）
            </label>
            <input
              id="target-lang"
              type="text"
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value.slice(0, 40))}
              placeholder="如：日语、法语"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-indigo-500/50 focus:outline-none"
            />
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200/90">
          {error}
        </p>
      )}

      <ActionButton
        label="开始写作"
        loadingLabel="AI 撰写中…"
        onClick={() => void handleGenerate()}
        disabled={!input.trim() || aiConfigured === false}
        loading={loading}
      />

      {output && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-white/50">
              生成结果
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void copyOutput()}
                className="rounded-lg bg-white/5 px-4 py-2 text-xs text-white/70 hover:bg-white/10"
              >
                {copied ? "已复制" : "复制"}
              </button>
              <button
                type="button"
                onClick={downloadOutput}
                className="rounded-lg bg-indigo-600/25 px-4 py-2 text-xs text-indigo-100 ring-1 ring-indigo-500/35 hover:bg-indigo-600/35"
              >
                下载 Markdown
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5 max-h-[480px] overflow-y-auto">
            <pre className="whitespace-pre-wrap text-sm leading-relaxed text-white/80 font-sans">
              {output}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
