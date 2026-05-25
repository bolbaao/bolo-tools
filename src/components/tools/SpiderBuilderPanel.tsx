"use client";

import MockButton from "@/components/MockButton";
import { useState } from "react";

const outputFormats = ["JSON", "CSV", "Excel"];
const schedules = ["立即执行", "每小时", "每天", "每周"];

const defaultCode = `// 演示爬虫模板 — 正式版将自动生成
const axios = require('axios');
const cheerio = require('cheerio');

async function crawl() {
  const url = '{{URL}}';
  const res = await axios.get(url);
  const $ = cheerio.load(res.data);
  const items = [];
  $('{{SELECTOR}}').each((i, el) => {
    items.push({ title: $(el).text().trim() });
  });
  return items;
}`;

export default function SpiderBuilderPanel() {
  const [url, setUrl] = useState("https://example.com/list");
  const [selector, setSelector] = useState(".item-title");
  const [listSelector, setListSelector] = useState(".list-item");
  const [format, setFormat] = useState("JSON");
  const [schedule, setSchedule] = useState("立即执行");
  const [code, setCode] = useState(defaultCode);
  const [logs, setLogs] = useState<string[]>([]);

  const generateCode = () => {
    setCode(
      defaultCode
        .replace("{{URL}}", url || "https://example.com")
        .replace("{{SELECTOR}}", selector || ".item")
    );
    setLogs((l) => [...l, `[${new Date().toLocaleTimeString()}] 已生成爬虫脚本`]);
  };

  const runMock = () => {
    setLogs((l) => [
      ...l,
      `[${new Date().toLocaleTimeString()}] 开始抓取 ${url}`,
      `[${new Date().toLocaleTimeString()}] 匹配到 12 条数据（演示）`,
      `[${new Date().toLocaleTimeString()}] 已导出为 ${format} 格式`,
    ]);
  };

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="spider-url" className="block text-sm text-white/60 mb-2">
          目标网址
        </label>
        <input
          id="spider-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-slate-400/50 focus:outline-none font-mono text-xs sm:text-sm"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="list-sel" className="block text-sm text-white/60 mb-2">
            列表选择器
          </label>
          <input
            id="list-sel"
            type="text"
            value={listSelector}
            onChange={(e) => setListSelector(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-slate-400/50"
          />
        </div>
        <div>
          <label htmlFor="item-sel" className="block text-sm text-white/60 mb-2">
            字段选择器
          </label>
          <input
            id="item-sel"
            type="text"
            value={selector}
            onChange={(e) => setSelector(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-slate-400/50"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-white/60 mb-2">导出格式</label>
        <div className="flex flex-wrap gap-2">
          {outputFormats.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={`rounded-lg px-3 py-1.5 text-sm transition-all ${
                format === f
                  ? "bg-slate-600/40 text-slate-200 border border-slate-500/40"
                  : "bg-white/5 text-white/50 border border-white/8 hover:bg-white/10"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm text-white/60 mb-2">执行计划</label>
        <div className="flex flex-wrap gap-2">
          {schedules.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSchedule(s)}
              className={`rounded-lg px-3 py-1.5 text-sm transition-all ${
                schedule === s
                  ? "bg-zinc-600/35 text-zinc-200 border border-zinc-500/35"
                  : "bg-white/5 text-white/50 border border-white/8 hover:bg-white/10"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={generateCode}
          className="flex-1 min-w-[120px] rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 transition-colors"
        >
          生成脚本
        </button>
        <button
          type="button"
          onClick={runMock}
          className="flex-1 min-w-[120px] rounded-xl bg-gradient-to-r from-slate-600 to-zinc-700 px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          运行爬虫（演示）
        </button>
      </div>

      <div>
        <label className="block text-sm text-white/60 mb-2">脚本预览</label>
        <pre className="rounded-xl border border-white/8 bg-black/40 p-4 text-xs text-emerald-400/90 overflow-x-auto max-h-48 font-mono leading-relaxed">
          {code}
        </pre>
      </div>

      {logs.length > 0 && (
        <div>
          <label className="block text-sm text-white/60 mb-2">运行日志</label>
          <div className="rounded-xl border border-white/8 bg-black/30 p-3 max-h-32 overflow-y-auto font-mono text-xs text-white/50 space-y-1">
            {logs.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>
      )}

      <MockButton label="保存爬虫任务" successMessage="任务已保存至队列（演示）" />
      <p className="text-center text-xs text-white/25">
        请遵守目标网站 robots 协议与相关法律法规 · 当前为前端演示
      </p>
    </div>
  );
}
