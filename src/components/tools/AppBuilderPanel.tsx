"use client";

import ActionButton from "@/components/ActionButton";
import { useAgentPrefill } from "@/hooks/useAgentPrefill";
import { ApiError, apiGet, apiPost, downloadText } from "@/lib/api";
import { AI_SERVICE_UNAVAILABLE } from "@/lib/service-message";
import { useCallback, useEffect, useMemo, useState } from "react";

type AppType = { id: string; label: string };

const EXAMPLE_APPS = [
  "做一个番茄钟 + 待办清单，深色主题",
  "做一个 BMI 计算器，带历史记录",
  "做一个产品发布落地页，科技感",
  "做一个猜数字小游戏，有计分和重开",
];

export default function AppBuilderPanel() {
  const [description, setDescription] = useState("");
  const [appName, setAppName] = useState("");
  const [appType, setAppType] = useState("tool");
  const [appTypes, setAppTypes] = useState<AppType[]>([]);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);

  const applyPrefill = useCallback((fields: Record<string, string>) => {
    if (fields.description) setDescription(fields.description);
    if (fields.appName) setAppName(fields.appName);
    if (fields.appType) setAppType(fields.appType);
  }, []);
  useAgentPrefill("app-builder", applyPrefill);

  useEffect(() => {
    apiGet<{ ok: boolean; aiConfigured: boolean; appTypes: AppType[] }>(
      "/api/app-builder/capabilities",
    )
      .then((d) => {
        setAiConfigured(d.aiConfigured);
        setAppTypes(d.appTypes || []);
      })
      .catch(() => setAiConfigured(false));
  }, []);

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    setHtml(null);
    setTitle(null);
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
          description: description.trim(),
          appType,
          appName: appName.trim() || undefined,
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
  };

  const downloadHtml = () => {
    if (!html) return;
    const filename = `${(title || appName || "my-app").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")}.html`;
    downloadText(html, filename, "text/html;charset=utf-8");
  };

  const openPreview = () => {
    if (!html) return;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const previewSrcDoc = useMemo(() => html ?? "", [html]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/5 px-5 py-4">
        <p className="text-sm text-white/65 leading-relaxed">
          用自然语言描述需求，AI 一键生成可独立运行的单页 Web 应用。生成后可预览、下载 HTML，或部署到任意静态托管。
        </p>
      </div>

      {aiConfigured === false && (
        <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-amber-100/85">
          {AI_SERVICE_UNAVAILABLE}
        </p>
      )}

      <div>
        <label htmlFor="app-name" className="block text-sm text-white/60 mb-2">
          应用名称（可选）
        </label>
        <input
          id="app-name"
          type="text"
          value={appName}
          onChange={(e) => setAppName(e.target.value.slice(0, 60))}
          placeholder="我的待办 App"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
        />
      </div>

      <div>
        <label className="block text-sm text-white/60 mb-2">应用类型</label>
        <div className="flex flex-wrap gap-2">
          {(appTypes.length
            ? appTypes
            : [
                { id: "tool", label: "实用小工具" },
                { id: "landing", label: "落地页" },
                { id: "dashboard", label: "看板" },
                { id: "game", label: "小游戏" },
                { id: "form", label: "表单" },
              ]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setAppType(t.id)}
              className={`rounded-lg px-3 py-1.5 text-xs ${
                appType === t.id
                  ? "bg-cyan-600/30 text-cyan-100 ring-1 ring-cyan-500/40"
                  : "bg-white/5 text-white/50 hover:bg-white/8"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="app-desc" className="block text-sm text-white/60 mb-2">
          需求描述
        </label>
        <textarea
          id="app-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 4000))}
          rows={6}
          placeholder="详细描述功能、界面风格、交互方式…越具体效果越好"
          className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
        />
        <p className="mt-1 text-right text-xs text-white/25">{description.length} / 4000</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {EXAMPLE_APPS.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setDescription(ex)}
            className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/45 hover:bg-white/8 hover:text-white/65 transition-colors"
          >
            {ex.slice(0, 16)}…
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200/90">
          {error}
        </p>
      )}

      <ActionButton
        label="一键生成 App"
        loadingLabel="AI 正在编写应用…"
        onClick={handleGenerate}
        disabled={!description.trim() || aiConfigured === false}
        loading={loading}
      />

      {html && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white/85">{title || "生成完成"}</p>
              {provider && <p className="text-xs text-white/35 mt-0.5">AI 已生成</p>}
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
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2 border-b border-white/8 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
              <span className="ml-2 text-xs text-white/30">实时预览</span>
            </div>
            <iframe
              key={previewKey}
              title="App 预览"
              srcDoc={previewSrcDoc}
              sandbox="allow-scripts allow-forms allow-modals allow-popups"
              className="h-[480px] w-full bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
