"use client";

import ActionButton from "@/components/ActionButton";
import { useAgentPrefill } from "@/hooks/useAgentPrefill";
import { ApiError, apiGet, apiPost, downloadText } from "@/lib/api";
import { AI_SERVICE_UNAVAILABLE } from "@/lib/service-message";
import { useCallback, useEffect, useMemo, useState } from "react";

type AppType = { id: string; label: string; hint?: string };

type AppPreset = {
  id: string;
  appType: string;
  appName: string;
  title: string;
  description: string;
  descriptionPreview: string;
};

export default function AppBuilderPanel() {
  const [description, setDescription] = useState("");
  const [appName, setAppName] = useState("");
  const [appType, setAppType] = useState("tool");
  const [presetId, setPresetId] = useState<string | null>(null);
  const [appTypes, setAppTypes] = useState<AppType[]>([]);
  const [presets, setPresets] = useState<AppPreset[]>([]);
  const [shortcutsNote, setShortcutsNote] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);

  const handleGenerate = useCallback(
    async (overrides?: { description?: string; appType?: string; appName?: string }) => {
      const desc = (overrides?.description ?? description).trim();
      const type = overrides?.appType ?? appType;
      const name = overrides?.appName ?? appName;
      if (!desc) return;
      if (overrides?.description) setDescription(overrides.description);
      if (overrides?.appType) setAppType(overrides.appType);
      if (overrides?.appName) setAppName(overrides.appName);
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
            description: desc,
            appType: type,
            appName: name.trim() || undefined,
            presetId: presetId || undefined,
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
    [description, appType, appName, presetId],
  );

  useAgentPrefill("app-builder", {
    apply: (fields) => {
      if (fields.description) setDescription(fields.description);
      if (fields.appName) setAppName(fields.appName);
      if (fields.appType) setAppType(fields.appType);
    },
    canSubmit: (fields) => Boolean(fields.description?.trim()),
    submit: (fields) =>
      handleGenerate({
        description: fields.description,
        appType: fields.appType,
        appName: fields.appName,
      }),
  });

  useEffect(() => {
    apiGet<{
      ok: boolean;
      aiConfigured: boolean;
      appTypes: AppType[];
      presets?: AppPreset[];
      notes?: { shortcuts?: string };
    }>("/api/app-builder/capabilities")
      .then((d) => {
        setAiConfigured(d.aiConfigured);
        setAppTypes(d.appTypes || []);
        setPresets(d.presets || []);
        setShortcutsNote(d.notes?.shortcuts ?? null);
      })
      .catch(() => setAiConfigured(false));
  }, []);

  const selectedTypeHint = appTypes.find((t) => t.id === appType)?.hint;

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

  const previewSrcDoc = useMemo(() => html ?? "", [html]);

  const shortcutPresets = presets.filter((p) => p.appType === "shortcuts" || p.appType === "api");
  const otherPresets = presets.filter((p) => p.appType !== "shortcuts" && p.appType !== "api");

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/5 px-5 py-4 space-y-2">
        <p className="text-sm text-white/65 leading-relaxed">
          用自然语言或<strong className="font-normal text-cyan-200/90">内置需求模板</strong>
          描述功能，AI 生成可独立运行的单页 Web 应用。做<strong className="font-normal text-cyan-200/90">快捷指令</strong>
          请选「快捷指令配套」类型——生成的是可被快捷指令 URL 调用的网页，不是 .shortcut 文件。
        </p>
      </div>

      {aiConfigured === false && (
        <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-amber-100/85">
          {AI_SERVICE_UNAVAILABLE}
        </p>
      )}

      {presets.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-white/60">内置需求模板（点击填入，可再修改）</p>
          {shortcutPresets.length > 0 && (
            <div>
              <p className="text-xs text-cyan-300/70 mb-2">快捷指令 / API</p>
              <div className="flex flex-wrap gap-2">
                {shortcutPresets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors max-w-[220px] ${
                      presetId === p.id
                        ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-100"
                        : "border-white/10 bg-white/[0.03] text-white/55 hover:border-cyan-500/30"
                    }`}
                  >
                    <span className="block font-medium text-white/80">{p.title}</span>
                    <span className="block mt-0.5 text-white/35 line-clamp-2">{p.descriptionPreview}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {otherPresets.length > 0 && (
            <div>
              <p className="text-xs text-white/40 mb-2">常用应用</p>
              <div className="flex flex-wrap gap-2">
                {otherPresets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors max-w-[200px] ${
                      presetId === p.id
                        ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-100"
                        : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/20"
                    }`}
                  >
                    <span className="block font-medium text-white/75">{p.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <label htmlFor="app-name" className="block text-sm text-white/60 mb-2">
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
          placeholder="留空则按功能自动命名，勿填平台名"
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
        {selectedTypeHint && (
          <p className="mt-2 text-xs text-white/40 leading-relaxed">{selectedTypeHint}</p>
        )}
        {(appType === "shortcuts" || appType === "api") && shortcutsNote && (
          <p className="mt-2 text-xs text-cyan-200/60 leading-relaxed rounded-lg bg-cyan-500/5 border border-cyan-500/15 px-3 py-2">
            {shortcutsNote}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="app-desc" className="block text-sm text-white/60 mb-2">
          需求描述
        </label>
        <textarea
          id="app-desc"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value.slice(0, 4000));
            setPresetId(null);
          }}
          rows={8}
          placeholder={
            appType === "shortcuts"
              ? "例：action=encode 对 text 参数 Base64 编码；?format=json 纯 JSON 输出；含快捷指令 3 步配置向导…"
              : "详细描述功能、界面风格、交互方式…越具体效果越好"
          }
          className="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 min-h-[160px]"
        />
        <p className="mt-1 text-right text-xs text-white/25">{description.length} / 4000</p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200/90">
          {error}
        </p>
      )}

      <ActionButton
        label="一键生成 App"
        loadingLabel="AI 正在编写应用…"
        onClick={() => void handleGenerate()}
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

          {(appType === "shortcuts" || appType === "api") && (
            <p className="text-xs text-white/40 leading-relaxed">
              部署到可访问的 URL 后，在快捷指令中添加「获取 URL 内容」，填入带 action 参数的链接即可调用。
            </p>
          )}

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
