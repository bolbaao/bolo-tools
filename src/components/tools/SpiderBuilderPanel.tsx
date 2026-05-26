"use client";

import ActionButton from "@/components/ActionButton";
import { ApiError, apiPost, downloadBlob } from "@/lib/api";
import { SPIDER_MOODS, SPIDER_PRESETS, type SpiderPreset } from "@/lib/spider-presets";
import { useMemo, useState } from "react";

type CrawlItem = { title: string; link: string };

type CrawlResult = {
  ok: boolean;
  count: number;
  items: CrawlItem[];
  pageTitle?: string;
  matchedSelector?: string | null;
};

type Step = 1 | 2 | 3;

const OUTPUT_FORMATS = ["JSON", "CSV"] as const;

function SpiderMascot({ mood }: { mood: keyof typeof SPIDER_MOODS }) {
  const m = SPIDER_MOODS[mood];
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-500/20 bg-gradient-to-br from-slate-500/15 to-zinc-600/10 px-5 py-4">
      <span
        className={`text-4xl select-none ${mood === "crawling" ? "animate-bounce" : ""}`}
        aria-hidden
      >
        {m.emoji}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-white/85">{m.line}</p>
        {mood === "crawling" && (
          <p className="mt-1 text-xs text-white/40">正在请求页面并解析 HTML…</p>
        )}
      </div>
    </div>
  );
}

function StepPill({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition-all ${
        active
          ? "bg-slate-500/25 text-slate-100 ring-1 ring-slate-400/35"
          : done
            ? "bg-emerald-500/10 text-emerald-200/90 ring-1 ring-emerald-500/20"
            : "bg-white/5 text-white/35 ring-1 ring-white/8"
      }`}
    >
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
          done ? "bg-emerald-500/30" : active ? "bg-slate-400/30" : "bg-white/10"
        }`}
      >
        {done ? "✓" : n}
      </span>
      {label}
    </div>
  );
}

export default function SpiderBuilderPanel() {
  const [step, setStep] = useState<Step>(1);
  const [presetId, setPresetId] = useState(SPIDER_PRESETS[0].id);
  const [url, setUrl] = useState(SPIDER_PRESETS[0].sampleUrl);
  const [listSelector, setListSelector] = useState(SPIDER_PRESETS[0].listSelector);
  const [itemSelector, setItemSelector] = useState(SPIDER_PRESETS[0].itemSelector);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [format, setFormat] = useState<(typeof OUTPUT_FORMATS)[number]>("JSON");
  const [code, setCode] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [items, setItems] = useState<CrawlItem[]>([]);
  const [pageTitle, setPageTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preset = useMemo(
    () => SPIDER_PRESETS.find((p) => p.id === presetId) ?? SPIDER_PRESETS[0],
    [presetId],
  );

  const mood = useMemo((): keyof typeof SPIDER_MOODS => {
    if (loading) return "crawling";
    if (error) return "error";
    if (items.length > 0) return "success";
    if (step >= 2 && url.trim()) return "ready";
    return "idle";
  }, [loading, error, items.length, step, url]);

  const pushLog = (msg: string) => {
    setLogs((l) => [...l, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const applyPreset = (p: SpiderPreset) => {
    setPresetId(p.id);
    setUrl(p.sampleUrl);
    setListSelector(p.listSelector);
    setItemSelector(p.itemSelector);
    setError(null);
    pushLog(`切换场景：${p.title}`);
  };

  const runSpider = async () => {
    if (!url.trim()) {
      setError("请先填写目标网址");
      return;
    }
    setLoading(true);
    setError(null);
    setItems([]);
    setPageTitle(null);
    try {
      const data = await apiPost<CrawlResult>("/api/spider/run", {
        url: url.trim(),
        listSelector,
        itemSelector,
        limit: 40,
      });
      setItems(data.items);
      setPageTitle(data.pageTitle ?? null);
      setStep(3);
      if (data.count > 0) {
        pushLog(
          `抓取成功！从「${data.pageTitle || "页面"}」收获 ${data.count} 条${
            data.matchedSelector ? `（列表：${data.matchedSelector}）` : ""
          }`,
        );
      } else {
        pushLog("没有抓到内容，试试「高级设置」里调整选择器");
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "抓取失败");
      pushLog("抓取失败，请检查网址是否可访问");
    } finally {
      setLoading(false);
    }
  };

  const generateCode = async () => {
    setCodeLoading(true);
    setError(null);
    try {
      const data = await apiPost<{ ok: boolean; code: string }>("/api/spider/generate", {
        url: url.trim() || preset.sampleUrl,
        listSelector,
        itemSelector,
      });
      setCode(data.code);
      setAdvancedOpen(true);
      pushLog("已生成 Node.js 爬虫脚本，可部署到服务器定时跑");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "生成失败");
    } finally {
      setCodeLoading(false);
    }
  };

  const exportData = () => {
    if (!items.length) return;
    const content =
      format === "CSV"
        ? "title,link\n" + items.map((i) => `"${i.title.replace(/"/g, '""')}","${i.link.replace(/"/g, '""')}"`).join("\n")
        : JSON.stringify(items, null, 2);
    const ext = format === "CSV" ? "csv" : "json";
    downloadBlob(
      new Blob([content], { type: format === "CSV" ? "text/csv" : "application/json" }),
      `spider-catch-${Date.now()}.${ext}`,
    );
    pushLog(`已导出 ${format} 文件`);
  };

  const copyCode = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    pushLog("脚本已复制到剪贴板");
  };

  return (
    <div className="space-y-6">
      <SpiderMascot mood={mood} />

      <div className="flex flex-wrap gap-2">
        <StepPill n={1} label="选场景" active={step === 1} done={step > 1} />
        <StepPill n={2} label="填网址" active={step === 2} done={step > 2} />
        <StepPill n={3} label="看收获" active={step === 3} done={false} />
      </div>

      {step === 1 && (
        <section className="space-y-4">
          <p className="text-sm text-white/45">
            不用懂 CSS 也能开抓——选一个最接近你需求的场景，小蜘蛛会带好「渔网」。
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {SPIDER_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  applyPreset(p);
                  setStep(2);
                }}
                className={`text-left rounded-2xl border p-4 transition-all hover:scale-[1.01] active:scale-[0.99] ${
                  presetId === p.id
                    ? "border-slate-400/40 bg-slate-500/15 ring-1 ring-slate-400/25"
                    : "border-white/10 bg-white/[0.03] hover:border-slate-500/30 hover:bg-slate-500/5"
                }`}
              >
                <span className="text-2xl">{p.emoji}</span>
                <p className="mt-2 font-medium text-white/90">{p.title}</p>
                <p className="mt-1 text-xs text-white/40 leading-relaxed">{p.description}</p>
                <p className="mt-2 text-[10px] text-slate-400/80">{p.tip}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-white/50">
              当前场景：<span className="text-white/80">{preset.emoji} {preset.title}</span>
            </p>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs text-white/40 hover:text-white/65"
            >
              ← 换场景
            </button>
          </div>

          <label className="block space-y-2">
            <span className="text-sm text-white/55">目标网址</span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-slate-400/40"
            />
            <button
              type="button"
              onClick={() => {
                setUrl(preset.sampleUrl);
                pushLog(`已填入示例站：${preset.sampleUrl}`);
              }}
              className="text-xs text-violet-300/90 hover:text-violet-200"
            >
              使用示例网址（{preset.sampleUrl.replace(/^https?:\/\//, "")}）
            </button>
          </label>

          <details
            open={advancedOpen}
            onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
            className="rounded-xl border border-white/8 bg-white/[0.02]"
          >
            <summary className="cursor-pointer px-4 py-3 text-sm text-white/55 hover:text-white/75">
              高级设置 · CSS 选择器（可选）
            </summary>
            <div className="grid gap-3 border-t border-white/8 p-4 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs text-white/40">列表选择器</span>
                <input
                  value={listSelector}
                  onChange={(e) => setListSelector(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs font-mono text-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-white/40">字段选择器</span>
                <input
                  value={itemSelector}
                  onChange={(e) => setItemSelector(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs font-mono text-white"
                />
              </label>
              <p className="sm:col-span-2 text-[10px] text-white/30">
                多个选择器用英文逗号分隔，会按顺序尝试第一个能匹配到的。
              </p>
            </div>
          </details>

          <div className="flex flex-col gap-2 sm:flex-row">
            <ActionButton
              label="出发抓取！"
              loadingLabel="织网中…"
              loading={loading}
              onClick={runSpider}
              className="!from-slate-600 !to-zinc-700 !shadow-slate-600/25 sm:flex-1"
            />
            <button
              type="button"
              onClick={() => void generateCode()}
              disabled={codeLoading}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70 hover:bg-white/10 disabled:opacity-50 sm:flex-1"
            >
              {codeLoading ? "生成中…" : "顺便生成 Node 脚本"}
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-white/90">
                {items.length > 0 ? `捕获 ${items.length} 条数据` : "这次网是空的"}
              </p>
              {pageTitle && (
                <p className="mt-1 text-xs text-white/40 truncate max-w-md">来源：{pageTitle}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-lg px-3 py-1.5 text-xs text-white/50 ring-1 ring-white/10 hover:bg-white/5"
              >
                再抓一次
              </button>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={exportData}
                  className="rounded-lg px-3 py-1.5 text-xs text-violet-200 ring-1 ring-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20"
                >
                  导出 {format}
                </button>
              )}
            </div>
          </div>

          {items.length > 0 && (
            <>
              <div className="flex gap-2">
                {OUTPUT_FORMATS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className={`rounded-lg px-3 py-1 text-xs ${
                      format === f
                        ? "bg-slate-500/25 text-slate-100 ring-1 ring-slate-400/30"
                        : "bg-white/5 text-white/45 ring-1 ring-white/8"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <ul className="max-h-64 overflow-y-auto rounded-2xl border border-white/10 divide-y divide-white/5">
                {items.map((item, i) => (
                  <li key={i} className="px-4 py-3 hover:bg-white/[0.02]">
                    <p className="text-sm text-white/85 line-clamp-2">{item.title}</p>
                    {item.link && (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block text-[11px] text-violet-300/80 truncate hover:underline"
                      >
                        {item.link}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {items.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/15 px-6 py-8 text-center space-y-3">
              <p className="text-sm text-white/45">试试示例站 quotes.toscrape.com，或打开高级设置微调选择器</p>
              <button
                type="button"
                onClick={() => {
                  applyPreset(SPIDER_PRESETS.find((p) => p.id === "quotes")!);
                  setStep(2);
                  setAdvancedOpen(true);
                }}
                className="text-sm text-violet-300 hover:text-violet-200"
              >
                一键切换到「列表语录」示例 →
              </button>
            </div>
          )}
        </section>
      )}

      {error && (
        <p className="text-center text-sm text-red-400/90 rounded-xl bg-red-500/10 px-4 py-2 ring-1 ring-red-500/20">
          {error}
        </p>
      )}

      {code && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/55">Node.js 脚本预览</span>
            <button
              type="button"
              onClick={() => void copyCode()}
              className="text-xs text-emerald-300/90 hover:text-emerald-200"
            >
              复制代码
            </button>
          </div>
          <pre className="rounded-xl border border-emerald-500/15 bg-black/50 p-4 text-[11px] text-emerald-400/90 overflow-x-auto max-h-40 font-mono">
            {code}
          </pre>
        </div>
      )}

      {logs.length > 0 && (
        <div
          className="rounded-xl border border-white/8 bg-black/40 p-3 max-h-28 overflow-y-auto font-mono text-[11px] text-white/45 space-y-0.5"
          aria-live="polite"
        >
          {logs.slice(-8).map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}

      <p className="text-center text-[11px] text-white/25 leading-relaxed">
        请遵守目标网站 robots 协议与法律法规 · 仅抓取你有权访问的公开页面
      </p>
    </div>
  );
}
