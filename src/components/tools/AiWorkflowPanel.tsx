"use client";

import ActionButton from "@/components/ActionButton";
import {
  ToolError,
  ToolNotice,
  ToolPresetCard,
  ToolPresetGrid,
  ToolSection,
} from "@/components/tools/ToolSection";
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

  const outputsMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of results) m[r.stepId] = r.output;
    return m;
  }, [results]);

  const nextStepIndex = results.length;

  const runWorkflow = useCallback(
    async (
      runAll: boolean,
      overrides?: { workflowId?: string; input?: string },
    ) => {
      const wfId = overrides?.workflowId ?? workflowId;
      const inputVal = (overrides?.input ?? input).trim();
      if (!inputVal || !wfId) return;
      if (overrides?.workflowId) setWorkflowId(overrides.workflowId);
      if (overrides?.input) setInput(overrides.input);
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
            workflowId: wfId,
            input: inputVal,
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
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "执行失败");
      } finally {
        setLoading(false);
      }
    },
    [workflowId, input, nextStepIndex, outputsMap],
  );

  useAgentPrefill("ai-workflow", {
    apply: (fields) => {
      if (fields.workflowId) setWorkflowId(fields.workflowId);
      if (fields.input) setInput(fields.input);
    },
    canSubmit: (fields) => Boolean(fields.input?.trim()),
    submit: (fields) =>
      runWorkflow(true, {
        workflowId: fields.workflowId,
        input: fields.input,
      }),
  });

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
      {aiConfigured === false && <ToolNotice>{AI_SERVICE_UNAVAILABLE}</ToolNotice>}

      <div className="tool-workflow-visual" aria-hidden>
        <div className="tool-workflow-node">
          <span className="tool-workflow-node-icon">📥</span>
          <span>输入</span>
        </div>
        <span className="tool-workflow-arrow">→</span>
        <div className="tool-workflow-node">
          <span className="tool-workflow-node-icon">✦</span>
          <span>AI 处理</span>
        </div>
        <span className="tool-workflow-arrow">→</span>
        <div className="tool-workflow-node">
          <span className="tool-workflow-node-icon">📤</span>
          <span>输出</span>
        </div>
      </div>

      <div>
        <label htmlFor="workflow-input" className="block text-sm mb-2">
          主题 / 初始素材
        </label>
        <textarea
          id="workflow-input"
          data-tool-primary-input
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, 4000))}
          rows={5}
          placeholder="例如：写一篇关于「春季露营装备清单」的种草内容，面向都市年轻人"
          className="w-full resize-none"
        />
      </div>

      {workflow && results.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {workflow.steps.map((s, i) => {
            const done = results.some((r) => r.stepId === s.id);
            const active = i === nextStepIndex && !completed;
            return (
              <span
                key={s.id}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${
                  done
                    ? "bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/25"
                    : active
                      ? "bg-violet-500/15 text-violet-700 ring-1 ring-violet-500/25"
                      : "bg-black/[0.03] text-black/40 ring-1 ring-black/6"
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

      {error && <ToolError>{error}</ToolError>}

      <ActionButton
        label="创建工作流"
        loadingLabel="工作流执行中…"
        onClick={() => void runWorkflow(true)}
        disabled={!input.trim() || aiConfigured === false}
        loading={loading}
      />

      {workflows.length > 0 && (
        <ToolSection title="模板推荐" desc="选择一条创作流程，分步或一键跑完">
          <ToolPresetGrid>
            {workflows.slice(0, 4).map((w) => (
              <ToolPresetCard
                key={w.id}
                title={w.label}
                desc={w.description}
                active={workflowId === w.id}
                onClick={() => {
                  setWorkflowId(w.id);
                  reset();
                }}
              />
            ))}
          </ToolPresetGrid>
        </ToolSection>
      )}

      {workflow && (
        <details className="tool-form-card">
          <summary>分步执行</summary>
          <div className="pt-3">
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
        </details>
      )}

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
