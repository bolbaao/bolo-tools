"use client";

import ActionButton from "@/components/ActionButton";
import { useAgentPrefill } from "@/hooks/useAgentPrefill";
import { ApiError, apiGet, apiPost, downloadText } from "@/lib/api";
import { AI_SERVICE_UNAVAILABLE } from "@/lib/service-message";
import { useCallback, useEffect, useMemo, useState } from "react";

type WorkflowStep = { id: string; title: string };
type Workflow = { id: string; label: string; description: string; steps: WorkflowStep[] };

type StepResult = {
  stepId: string;
  stepTitle: string;
  stepIndex: number;
  output: string;
  provider?: string;
};

export default function AiWorkflowPanel() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workflowId, setWorkflowId] = useState("");
  const [input, setInput] = useState("");
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<StepResult[]>([]);
  const [completed, setCompleted] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);

  const applyPrefill = useCallback((fields: Record<string, string>) => {
    if (fields.workflowId) setWorkflowId(fields.workflowId);
    if (fields.input) setInput(fields.input);
  }, []);
  useAgentPrefill("ai-workflow", applyPrefill);

  useEffect(() => {
    apiGet<{ ok: boolean; aiConfigured: boolean; workflows: Workflow[] }>(
      "/api/ai-workflow/capabilities",
    )
      .then((d) => {
        setAiConfigured(d.aiConfigured);
        const list = d.workflows || [];
        setWorkflows(list);
        if (list[0]) setWorkflowId(list[0].id);
      })
      .catch(() => setAiConfigured(false));
  }, []);

  const workflow = useMemo(
    () => workflows.find((w) => w.id === workflowId),
    [workflows, workflowId],
  );

  const outputsMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of results) m[r.stepId] = r.output;
    return m;
  }, [results]);

  const nextStepIndex = results.length;

  const runWorkflow = async (runAll: boolean) => {
    if (!input.trim() || !workflowId) return;
    setLoading(true);
    setError(null);
    if (runAll) {
      setResults([]);
      setCompleted(false);
    }
    try {
      const data = await apiPost<{
        ok: boolean;
        results: StepResult[];
        completed: boolean;
        message?: string;
      }>(
        "/api/ai-workflow/run",
        {
          workflowId,
          input: input.trim(),
          runAll,
          stepIndex: runAll ? undefined : nextStepIndex,
          previousOutputs: runAll ? undefined : outputsMap,
        },
        { timeoutMs: runAll ? 360000 : 120000 },
      );
      if (runAll) {
        setResults(data.results || []);
      } else {
        setResults((prev) => [...prev, ...(data.results || [])]);
      }
      setCompleted(Boolean(data.completed));
      const p = data.results?.find((r) => r.provider)?.provider;
      if (p) setProvider(p);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "执行失败");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResults([]);
    setCompleted(false);
    setError(null);
  };

  const downloadAll = () => {
    if (!results.length) return;
    const body = results.map((r) => `## ${r.stepTitle}\n\n${r.output}`).join("\n\n---\n\n");
    const name = (workflow?.label || "workflow").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
    downloadText(body, `${name}-${Date.now()}.md`, "text/markdown;charset=utf-8");
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-violet-500/15 bg-violet-500/5 px-5 py-4">
        <p className="text-sm text-white/65 leading-relaxed">
          选择预设工作流，AI 按步骤串联执行：内容创作、社媒内容包、视频脚本等。可逐步运行或一键跑完全流程。
        </p>
      </div>

      {aiConfigured === false && (
        <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-amber-100/85">
          {AI_SERVICE_UNAVAILABLE}
        </p>
      )}

      <div>
        <label className="block text-sm text-white/60 mb-2">工作流模板</label>
        <div className="grid gap-2 sm:grid-cols-3">
          {workflows.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => {
                setWorkflowId(w.id);
                reset();
              }}
              className={`rounded-xl border px-4 py-3 text-left transition-all ${
                workflowId === w.id
                  ? "border-violet-500/40 bg-violet-500/10"
                  : "border-white/8 bg-white/[0.02] hover:bg-white/[0.04]"
              }`}
            >
              <p className="text-sm font-medium text-white/85">{w.label}</p>
              <p className="mt-1 text-[11px] text-white/40 leading-snug">{w.description}</p>
            </button>
          ))}
        </div>
      </div>

      {workflow && (
        <div className="flex flex-wrap gap-2">
          {workflow.steps.map((s, i) => {
            const done = results.some((r) => r.stepId === s.id);
            const active = i === nextStepIndex && !completed;
            return (
              <span
                key={s.id}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${
                  done
                    ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/25"
                    : active
                      ? "bg-violet-500/20 text-violet-100 ring-1 ring-violet-500/35"
                      : "bg-white/5 text-white/35 ring-1 ring-white/8"
                }`}
              >
                <span className="font-mono text-[10px] opacity-60">{i + 1}</span>
                {s.title}
                {done && " ✓"}
              </span>
            );
          })}
        </div>
      )}

      <div>
        <label htmlFor="workflow-input" className="block text-sm text-white/60 mb-2">
          主题 / 初始素材
        </label>
        <textarea
          id="workflow-input"
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, 4000))}
          rows={5}
          placeholder="例如：写一篇关于「春季露营装备清单」的种草内容，面向都市年轻人"
          className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
        />
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200/90">
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <ActionButton
          label="一键跑完全流程"
          loadingLabel="工作流执行中…"
          onClick={() => void runWorkflow(true)}
          disabled={!input.trim() || aiConfigured === false}
          loading={loading}
        />
        <ActionButton
          variant="secondary"
          label={
            completed
              ? "已完成"
              : nextStepIndex === 0
                ? "逐步执行（第一步）"
                : `逐步执行（第 ${nextStepIndex + 1} 步）`
          }
          loadingLabel="执行中…"
          onClick={() => void runWorkflow(false)}
          disabled={!input.trim() || aiConfigured === false || completed}
          loading={loading}
        />
      </div>

      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-white/50">
              执行结果
              {completed && " · 已全部完成"}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={reset}
                className="rounded-lg bg-white/5 px-4 py-2 text-xs text-white/70 hover:bg-white/10"
              >
                清空重来
              </button>
              <button
                type="button"
                onClick={downloadAll}
                className="rounded-lg bg-violet-600/25 px-4 py-2 text-xs text-violet-100 ring-1 ring-violet-500/35 hover:bg-violet-600/35"
              >
                下载全部
              </button>
            </div>
          </div>

          <ul className="space-y-3">
            {results.map((r) => (
              <li
                key={`${r.stepId}-${r.stepIndex}`}
                className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden"
              >
                <div className="border-b border-white/8 px-4 py-2.5 text-sm font-medium text-white/75">
                  {r.stepIndex + 1}. {r.stepTitle}
                </div>
                <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap p-4 text-sm leading-relaxed text-white/70 font-sans">
                  {r.output}
                </pre>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
