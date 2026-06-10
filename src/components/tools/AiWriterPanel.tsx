"use client";

import ActionButton from "@/components/ActionButton";
import CopyButton from "@/components/CopyButton";
import {
  ToolChip,
  ToolChipBar,
  ToolError,
  ToolNotice,
  ToolPresetCard,
  ToolPresetGrid,
  ToolSection,
} from "@/components/tools/ToolSection";
import { useAgentPrefill } from "@/hooks/useAgentPrefill";
import { ApiError, apiGet, apiPost, apiUpload, downloadText } from "@/lib/api";
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

const WRITING_TEMPLATES = [
  { mode: "article", title: "文章标题", desc: "快速生成吸睛标题", icon: "📝" },
  { mode: "work-report", title: "工作总结", desc: "周报月报轻松写", icon: "📊" },
  { mode: "social", title: "小红书文案", desc: "种草笔记一键生成", icon: "✨" },
  { mode: "email", title: "演讲稿", desc: "邮件与演讲稿", icon: "🎤" },
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
  "work-report":
    "本周完成：1）上线新版首页；2）修复 3 个用户反馈 bug；3）撰写 2 篇社媒文案。数据：日活 +12%。下周计划：推进视频工具优化。",
  resume:
    "张三，5 年产品经理经验。曾负责 XX App 从 0 到 1，DAU 50 万。擅长用户增长、数据分析、跨团队协作。目标岗位：高级产品经理。",
  "doc-speedread":
    "（可粘贴长文，或上传 PDF/Word 后自动提取）这是一份关于 2025 年远程办公趋势的行业报告……",
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
  const [docExtracting, setDocExtracting] = useState(false);

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
            length:
              modeVal === "article" || modeVal === "social" || modeVal === "work-report"
                ? length
                : undefined,
            targetLang: modeVal === "translate" ? targetLang || undefined : undefined,
          },
          { timeoutMs: 120000 },
        );
        setOutput(data.text);
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

  const downloadOutput = () => {
    if (!output) return;
    downloadText(output, `ai-writer-${mode}-${Date.now()}.md`, "text/markdown;charset=utf-8");
  };

  return (
    <div className="space-y-6">
      {aiConfigured === false && <ToolNotice>{AI_SERVICE_UNAVAILABLE}</ToolNotice>}

      <ToolChipBar>
        {modes.map((m) => (
          <ToolChip
            key={m.id}
            label={m.label}
            active={mode === m.id}
            onClick={() => {
              setMode(m.id);
              setError(null);
            }}
          />
        ))}
      </ToolChipBar>

      {(mode === "article" ||
        mode === "social" ||
        mode === "email" ||
        mode === "work-report" ||
        mode === "resume") && (
        <div>
          <label htmlFor="writer-topic" className="block text-sm text-white/60 mb-2">
            {mode === "work-report"
              ? "报告类型（可选，如：周报 / 月报 / 述职）"
              : mode === "resume"
                ? "目标岗位（可选）"
                : "主题说明（可选）"}
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
        <label htmlFor="writer-input" className="block text-sm mb-2">
          请输入你想写的内容或主题
        </label>
        {mode === "doc-speedread" && (
          <div className="mb-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60 hover:bg-white/8">
              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setDocExtracting(true);
                  setError(null);
                  try {
                    const fd = new FormData();
                    fd.append("file", f);
                    const raw = await apiUpload("/api/chat/extract-document", fd, {
                      timeoutMs: 120000,
                    });
                    if (raw instanceof Blob) throw new ApiError("服务返回异常");
                    const data = raw as { ok: boolean; file?: { content?: string } };
                    const text = data.file?.content?.trim();
                    if (!text) throw new ApiError("未能提取文档文字");
                    setInput(text.slice(0, 8000));
                  } catch (err) {
                    setError(err instanceof ApiError ? err.message : "文档提取失败");
                  } finally {
                    setDocExtracting(false);
                    e.target.value = "";
                  }
                }}
              />
              {docExtracting ? "正在提取文档…" : "上传 PDF / Word 提取文字"}
            </label>
          </div>
        )}
        <textarea
          id="writer-input"
          data-tool-primary-input
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, 8000))}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && input.trim() && !loading) {
              e.preventDefault();
              void handleGenerate();
            }
          }}
          rows={8}
          placeholder={EXAMPLES[mode] || "输入内容…"}
          className="w-full resize-none"
        />
        <p className="mt-2 text-right text-xs opacity-40">{input.length} / 8000</p>
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

        {(mode === "article" || mode === "social" || mode === "work-report") && (
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

      {error && <ToolError>{error}</ToolError>}

      <ActionButton
        label="开始写作"
        loadingLabel="AI 撰写中…"
        onClick={() => void handleGenerate()}
        disabled={!input.trim() || aiConfigured === false}
        loading={loading}
      />

      <ToolSection title="写作模板" desc="点击快速填入示例">
        <ToolPresetGrid>
          {WRITING_TEMPLATES.map((t) => (
            <ToolPresetCard
              key={t.mode}
              title={t.title}
              desc={t.desc}
              icon={t.icon}
              active={mode === t.mode}
              onClick={() => {
                setMode(t.mode);
                if (EXAMPLES[t.mode]) setInput(EXAMPLES[t.mode]);
                setError(null);
              }}
            />
          ))}
        </ToolPresetGrid>
      </ToolSection>

      {output && (
        <div className="space-y-3" data-tool-result="">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-white/50">
              生成结果 · {output.length} 字
            </p>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={output} />
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={loading || !input.trim()}
                className="rounded-lg bg-white/5 px-4 py-2 text-xs text-white/70 hover:bg-white/10 disabled:opacity-40"
              >
                再写一次
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
