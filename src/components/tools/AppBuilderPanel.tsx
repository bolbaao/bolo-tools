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

type AppType = { id: string; label: string; hint?: string };
type StyleTheme = { id: string; label: string; hint?: string };
type DeployNote = { id: string; title: string; steps: string[] };

type AppPreset = {
  id: string;
  appType: string;
  appName: string;
  title: string;
  description: string;
  descriptionPreview: string;
};

type HtmlVersion = { html: string; title: string | null; label: string };

type PreviewMode = "desktop" | "mobile";

const REFINE_SUGGESTIONS = [
  "把配色改成深色主题",
  "加大按钮和字号，更适合手机",
  "增加数据导出为 JSON 功能",
  "优化首屏布局，主操作更突出",
  "添加空状态与加载提示",
];

export default function AppBuilderPanel() {
  const [description, setDescription] = useState("");
  const [appName, setAppName] = useState("");
  const [appType, setAppType] = useState("tool");
  const [styleTheme, setStyleTheme] = useState("auto");
  const [presetId, setPresetId] = useState<string | null>(null);
  const [appTypes, setAppTypes] = useState<AppType[]>([]);
  const [styleThemes, setStyleThemes] = useState<StyleTheme[]>([]);
  const [presets, setPresets] = useState<AppPreset[]>([]);
  const [deployNotes, setDeployNotes] = useState<DeployNote[]>([]);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [refining, setRefining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [showSource, setShowSource] = useState(false);
  const [showDeploy, setShowDeploy] = useState(false);
  const [refineInstruction, setRefineInstruction] = useState("");
  const [versions, setVersions] = useState<HtmlVersion[]>([]);

  const pushVersion = useCallback((nextHtml: string, nextTitle: string | null, label: string) => {
    setVersions((prev) => {
      const entry = { html: nextHtml, title: nextTitle, label };
      const merged = [...prev, entry];
      return merged.slice(-5);
    });
  }, []);

  const applyResult = useCallback(
    (nextHtml: string, nextTitle: string | null, versionLabel: string) => {
      if (html) pushVersion(html, title, versionLabel === "初始生成" ? "生成前" : versionLabel);
      setHtml(nextHtml);
      setTitle(nextTitle);
      setPreviewKey((k) => k + 1);
    },
    [html, title, pushVersion],
  );

  const handleGenerate = useCallback(
    async (overrides?: {
      description?: string;
      appType?: string;
      appName?: string;
      styleTheme?: string;
    }) => {
      const desc = (overrides?.description ?? description).trim();
      const type = overrides?.appType ?? appType;
      const name = overrides?.appName ?? appName;
      const theme = overrides?.styleTheme ?? styleTheme;
      if (!desc) return;
      if (overrides?.description) setDescription(overrides.description);
      if (overrides?.appType) setAppType(overrides.appType);
      if (overrides?.appName) setAppName(overrides.appName);
      if (overrides?.styleTheme) setStyleTheme(overrides.styleTheme);
      setLoading(true);
      setError(null);
      setHtml(null);
      setTitle(null);
      setVersions([]);
      setRefineInstruction("");
      try {
        const data = await apiPost<{
          ok: boolean;
          html: string;
          title: string;
          provider?: string;
          message?: string;
        }>(
          "/api/app-builder/generate",
          {
            description: desc,
            appType: type,
            appName: name.trim() || undefined,
            presetId: presetId || undefined,
            styleTheme: theme,
          },
          { timeoutMs: 240000 },
        );
        setHtml(data.html);
        setTitle(data.title);
        setProvider(data.provider || null);
        setPreviewKey((k) => k + 1);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "生成失败");
      } finally {
        setLoading(false);
      }
    },
    [description, appType, appName, styleTheme, presetId],
  );

  const handleRefine = useCallback(async () => {
    const instruction = refineInstruction.trim();
    if (!html || !instruction) return;
    setRefining(true);
    setError(null);
    try {
      const data = await apiPost<{
        ok: boolean;
        html: string;
        title: string;
        provider?: string;
      }>(
        "/api/app-builder/refine",
        {
          html,
          instruction,
          appType,
          appName: appName.trim() || undefined,
        },
        { timeoutMs: 240000 },
      );
      applyResult(data.html, data.title, instruction.slice(0, 24));
      setRefineInstruction("");
      setProvider(data.provider || provider);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "优化失败");
    } finally {
      setRefining(false);
    }
  }, [refineInstruction, html, appType, appName, applyResult, provider]);

  const restoreVersion = useCallback(
    (index: number) => {
      const v = versions[index];
      if (!v) return;
      applyResult(v.html, v.title, `恢复：${v.label}`);
      setVersions((prev) => prev.slice(0, index));
    },
    [versions, applyResult],
  );

  useAgentPrefill("app-builder", {
    apply: (fields) => {
      if (fields.description) setDescription(fields.description);
      if (fields.appName) setAppName(fields.appName);
      if (fields.appType) setAppType(fields.appType);
      if (fields.styleTheme) setStyleTheme(fields.styleTheme);
    },
    canSubmit: (fields) => Boolean(fields.description?.trim()),
    submit: (fields) =>
      handleGenerate({
        description: fields.description,
        appType: fields.appType,
        appName: fields.appName,
        styleTheme: fields.styleTheme,
      }),
  });

  useEffect(() => {
    apiGet<{
      ok: boolean;
      aiConfigured: boolean;
      appTypes: AppType[];
      styleThemes?: StyleTheme[];
      presets?: AppPreset[];
      deployNotes?: DeployNote[];
      notes?: { shortcuts?: string };
    }>("/api/app-builder/capabilities")
      .then((d) => {
        setAiConfigured(d.aiConfigured);
        setAppTypes(d.appTypes || []);
        setStyleThemes(d.styleThemes || []);
        setPresets(d.presets || []);
        setDeployNotes(d.deployNotes || []);
      })
      .catch(() => setAiConfigured(false));
  }, []);

  const applyPreset = (preset: AppPreset) => {
    setPresetId(preset.id);
    setAppType(preset.appType);
    setAppName(preset.appName);
    setDescription(preset.description);
    setError(null);
  };

  const downloadHtml = () => {
    if (!html) return;
    const filename = `${(title || appName || "app").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_") || "app"}.html`;
    downloadText(html, filename, "text/html;charset=utf-8");
  };

  const openPreview = () => {
    if (!html) return;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const copySource = async () => {
    if (!html) return;
    try {
      await navigator.clipboard.writeText(html);
    } catch {
      /* ignore */
    }
  };

  const previewSrcDoc = useMemo(() => html ?? "", [html]);

  const otherPresets = presets.filter((p) => p.appType !== "shortcuts" && p.appType !== "api");

  const previewFrameClass =
    previewMode === "mobile"
      ? "mx-auto h-[520px] w-full max-w-[390px] rounded-[1.25rem] border-8 border-white/10 shadow-2xl"
      : "h-[480px] w-full";

  return (
    <div className="space-y-6">
      {aiConfigured === false && <ToolNotice>{AI_SERVICE_UNAVAILABLE}</ToolNotice>}

      <div>
        <label htmlFor="app-desc" className="block text-sm mb-2">
          描述你想要的应用
        </label>
        <textarea
          id="app-desc"
          data-tool-primary-input
          value={description}
          onChange={(e) => {
            setDescription(e.target.value.slice(0, 4000));
            setPresetId(null);
          }}
          rows={8}
          placeholder="例如：记账本、待办清单、读书笔记…"
          className="w-full resize-y min-h-[160px]"
        />
        <p className="mt-1 text-right text-xs opacity-40">{description.length} / 4000</p>
      </div>

      <details className="tool-form-card">
        <summary>高级选项（名称、类型、风格）</summary>
        <div className="space-y-4 pt-2">
          <div>
            <label htmlFor="app-name" className="block text-sm mb-2">
              应用名称（可选）
            </label>
            <input
              id="app-name"
              type="text"
              value={appName}
              onChange={(e) => {
                setAppName(e.target.value.slice(0, 60));
                setPresetId(null);
              }}
              placeholder="留空则按功能自动命名"
            />
          </div>

          <div>
            <label className="block text-sm mb-2">应用类型</label>
            <div className="flex flex-wrap gap-2">
              {(appTypes.length
                ? appTypes
                : [
                    { id: "tool", label: "实用小工具" },
                    { id: "shortcuts", label: "快捷指令配套" },
                    { id: "api", label: "API 模拟" },
                    { id: "landing", label: "落地页" },
                    { id: "dashboard", label: "看板" },
                    { id: "form", label: "表单" },
                    { id: "game", label: "小游戏" },
                  ]
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setAppType(t.id);
                    setPresetId(null);
                  }}
                  className={`tool-chip${appType === t.id ? " tool-chip--active" : ""}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm mb-2">视觉风格</label>
            <div className="flex flex-wrap gap-2">
              {(styleThemes.length
                ? styleThemes
                : [
                    { id: "auto", label: "智能匹配" },
                    { id: "dark", label: "深色现代" },
                    { id: "light", label: "清爽浅色" },
                    { id: "minimal", label: "极简黑白" },
                    { id: "colorful", label: "活力渐变" },
                    { id: "glass", label: "玻璃拟态" },
                  ]
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setStyleTheme(t.id)}
                  className={`tool-chip${styleTheme === t.id ? " tool-chip--active" : ""}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </details>

      {error && <ToolError>{error}</ToolError>}

      <ActionButton
        label="生成应用"
        loadingLabel="AI 正在编写应用…"
        onClick={() => void handleGenerate()}
        disabled={!description.trim() || aiConfigured === false}
        loading={loading}
      />

      {otherPresets.length > 0 && (
        <ToolSection title="热门模板" desc="点击填入，可再修改">
          <ToolPresetGrid>
            {otherPresets.slice(0, 4).map((p) => (
              <ToolPresetCard
                key={p.id}
                title={p.title}
                desc={p.descriptionPreview}
                active={presetId === p.id}
                onClick={() => applyPreset(p)}
              />
            ))}
          </ToolPresetGrid>
        </ToolSection>
      )}

      {html && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white/85">{title || "生成完成"}</p>
              {provider && <p className="text-xs text-white/35 mt-0.5">AI 已生成 · 可继续优化</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadHtml}
                className="rounded-lg bg-cyan-600/25 px-4 py-2 text-xs text-cyan-100 ring-1 ring-cyan-500/35 hover:bg-cyan-600/35 transition-colors"
              >
                下载 HTML
              </button>
              <button
                type="button"
                onClick={openPreview}
                className="rounded-lg bg-white/5 px-4 py-2 text-xs text-white/70 hover:bg-white/10 transition-colors"
              >
                新窗口预览
              </button>
              <button
                type="button"
                onClick={() => setShowSource((v) => !v)}
                className="rounded-lg bg-white/5 px-4 py-2 text-xs text-white/70 hover:bg-white/10 transition-colors"
              >
                {showSource ? "隐藏源码" : "查看源码"}
              </button>
              <button
                type="button"
                onClick={() => setShowDeploy((v) => !v)}
                className="rounded-lg bg-white/5 px-4 py-2 text-xs text-white/70 hover:bg-white/10 transition-colors"
              >
                {showDeploy ? "收起部署" : "部署指引"}
              </button>
            </div>
          </div>

          {versions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-white/40">历史版本：</span>
              {versions.map((v, i) => (
                <button
                  key={`${v.label}-${i}`}
                  type="button"
                  onClick={() => restoreVersion(i)}
                  className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-white/55 hover:bg-white/10 hover:text-white/75"
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
            <p className="text-sm text-white/60">继续优化（对话式修改，保留现有功能）</p>
            <textarea
              value={refineInstruction}
              onChange={(e) => setRefineInstruction(e.target.value.slice(0, 2000))}
              rows={3}
              placeholder="描述要改什么，例如：把主色改成绿色、增加导出按钮、优化移动端布局…"
              className="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-violet-500/40 focus:outline-none focus:ring-1 focus:ring-violet-500/25"
            />
            <div className="flex flex-wrap gap-2">
              {REFINE_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRefineInstruction(s)}
                  className="rounded-lg bg-violet-500/10 px-2.5 py-1 text-xs text-violet-200/80 ring-1 ring-violet-500/20 hover:bg-violet-500/15"
                >
                  {s}
                </button>
              ))}
            </div>
            <ActionButton
              label="应用修改"
              loadingLabel="AI 正在优化…"
              onClick={() => void handleRefine()}
              disabled={!refineInstruction.trim() || aiConfigured === false}
              loading={refining}
            />
          </div>

          {showSource && (
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <div className="flex items-center justify-between border-b border-white/8 px-4 py-2">
                <span className="text-xs text-white/40">HTML 源码 · {html.length.toLocaleString()} 字符</span>
                <button
                  type="button"
                  onClick={() => void copySource()}
                  className="text-xs text-cyan-300/80 hover:text-cyan-200"
                >
                  复制全部
                </button>
              </div>
              <pre className="max-h-64 overflow-auto bg-black/40 p-4 text-xs text-emerald-200/80 leading-relaxed">
                <code>{html}</code>
              </pre>
            </div>
          )}

          {showDeploy && deployNotes.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {deployNotes
                .filter((n) => n.id !== "shortcuts" || appType === "shortcuts" || appType === "api")
                .map((note) => (
                  <div
                    key={note.id}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <p className="text-sm font-medium text-white/75">{note.title}</p>
                    <ol className="mt-2 space-y-1 text-xs text-white/45 list-decimal list-inside">
                      {note.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </div>
                ))}
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                <span className="ml-2 text-xs text-white/30">实时预览</span>
              </div>
              <div className="flex rounded-lg bg-white/5 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setPreviewMode("desktop")}
                  className={`rounded-md px-3 py-1 ${
                    previewMode === "desktop" ? "bg-white/15 text-white/85" : "text-white/45"
                  }`}
                >
                  桌面
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("mobile")}
                  className={`rounded-md px-3 py-1 ${
                    previewMode === "mobile" ? "bg-white/15 text-white/85" : "text-white/45"
                  }`}
                >
                  手机
                </button>
              </div>
            </div>
            <div className={previewMode === "mobile" ? "bg-white/5 px-4 py-6" : ""}>
              <iframe
                key={previewKey}
                title="App 预览"
                srcDoc={previewSrcDoc}
                sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                className={`${previewFrameClass} bg-white`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
