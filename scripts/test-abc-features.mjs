#!/usr/bin/env node
/**
 * A/B/C 新功能冒烟：图像工坊扩展、PDF 工具箱、AI 写作场景
 * 用法: node scripts/test-abc-features.mjs
 */
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument, StandardFonts } from "pdf-lib";
import "../server/lib/env.mjs";

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;
let skipped = 0;

function ok(name, detail) {
  passed++;
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail) {
  failed++;
  console.error(`❌ ${name}${detail ? ` — ${detail}` : ""}`);
}

function skip(name, reason) {
  skipped++;
  console.log(`○ ${name} — 跳过: ${reason}`);
}

async function makePdfBuffer(text, pageNum = 1) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText(`${text} page-${pageNum}`, { x: 72, y: 700, size: 14, font });
  return Buffer.from(await pdf.save());
}

async function postMultipart(urlPath, form, timeoutMs = 120000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${urlPath}`, { method: "POST", body: form, signal: controller.signal });
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const data = await res.json().catch(() => ({}));
      return { status: res.status, data, buffer: null };
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    return { status: res.status, data: null, buffer };
  } finally {
    clearTimeout(timer);
  }
}

async function postJson(urlPath, body, timeoutMs = 120000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${urlPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  console.log(`\n🍍 A/B/C 新功能测试: ${BASE}\n`);

  const health = await fetch(`${BASE}/api/health`).then((r) => r.json()).catch(() => ({}));
  if (!health?.ok) {
    fail("健康检查", "服务未就绪");
    process.exit(1);
  }
  ok("健康检查");

  const docCap = await fetch(`${BASE}/api/documents/capabilities`).then((r) => r.json()).catch(() => ({}));
  const modes = docCap?.modes || {};
  for (const id of ["pdf-merge", "pdf-split", "pdf-compress"]) {
    if (modes[id]?.available !== false) ok(`文档能力 · ${id}`);
    else fail(`文档能力 · ${id}`, "不可用");
  }

  const pdfA = await makePdfBuffer("ABC-merge-A", 1);
  const pdfB = await makePdfBuffer("ABC-merge-B", 2);

  const mergeForm = new FormData();
  mergeForm.append("mode", "pdf-merge");
  mergeForm.append("files", new Blob([pdfA], { type: "application/pdf" }), "a.pdf");
  mergeForm.append("files", new Blob([pdfB], { type: "application/pdf" }), "b.pdf");
  const mergeRes = await postMultipart("/api/documents/convert", mergeForm);
  if (mergeRes.status === 200 && mergeRes.buffer?.length > 200) {
    const merged = await PDFDocument.load(mergeRes.buffer);
    if (merged.getPageCount() === 2) ok("PDF 合并", "2 页");
    else fail("PDF 合并", `页数=${merged.getPageCount()}`);
  } else {
    fail("PDF 合并", mergeRes.data?.error || `status=${mergeRes.status}`);
  }

  const twoPagePdf = await (async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (let i = 1; i <= 2; i++) {
      const page = doc.addPage([400, 500]);
      page.drawText(`split-page-${i}`, { x: 50, y: 450, size: 12, font });
    }
    return Buffer.from(await doc.save());
  })();

  const splitForm = new FormData();
  splitForm.append("mode", "pdf-split");
  splitForm.append("files", new Blob([twoPagePdf], { type: "application/pdf" }), "two.pdf");
  const splitRes = await postMultipart("/api/documents/convert", splitForm);
  if (splitRes.status === 200 && splitRes.buffer?.length > 100) {
    ok("PDF 拆分", `${splitRes.buffer.length} bytes zip`);
  } else {
    fail("PDF 拆分", splitRes.data?.error || `status=${splitRes.status}`);
  }

  const compressForm = new FormData();
  compressForm.append("mode", "pdf-compress");
  compressForm.append("files", new Blob([twoPagePdf], { type: "application/pdf" }), "two.pdf");
  const compressRes = await postMultipart("/api/documents/convert", compressForm);
  if (compressRes.status === 200 && compressRes.buffer?.length > 50) {
    ok("PDF 压缩", `${twoPagePdf.length} → ${compressRes.buffer.length} bytes`);
  } else {
    fail("PDF 压缩", compressRes.data?.error || `status=${compressRes.status}`);
  }

  const writerCap = await fetch(`${BASE}/api/ai-writer/capabilities`).then((r) => r.json()).catch(() => ({}));
  const writerIds = (writerCap?.modes || []).map((m) => m.id);
  for (const id of ["work-report", "resume", "doc-speedread"]) {
    if (writerIds.includes(id)) ok(`AI 写作模式 · ${id}`);
    else fail(`AI 写作模式 · ${id}`, "未注册");
  }

  if (writerCap?.aiConfigured) {
    const report = await postJson("/api/ai-writer/generate", {
      mode: "work-report",
      input: "本周完成首页改版，修复 2 个 bug，撰写 1 篇文案。",
      topic: "周报",
      tone: "professional",
      length: "short",
    });
    if (report.status === 200 && report.data?.text?.length > 50) {
      ok("AI 写作 · 工作报告", `${report.data.text.length} 字符`);
    } else {
      fail("AI 写作 · 工作报告", report.data?.error || `status=${report.status}`);
    }

    const resume = await postJson("/api/ai-writer/generate", {
      mode: "resume",
      input: "张三，3 年前端，熟悉 React/Next.js，做过电商后台。",
      topic: "前端工程师",
    });
    if (resume.status === 200 && resume.data?.text?.length > 50) {
      ok("AI 写作 · 简历", `${resume.data.text.length} 字符`);
    } else {
      fail("AI 写作 · 简历", resume.data?.error || `status=${resume.status}`);
    }

    const speed = await postJson("/api/ai-writer/generate", {
      mode: "doc-speedread",
      input:
        "本报告认为远程办公在 2025 年将继续增长。关键数据：企业采用率 68%，员工满意度提升 15%。建议：投资协作工具与异步沟通培训。",
    });
    if (speed.status === 200 && speed.data?.text?.length > 30) {
      ok("AI 写作 · 文档速读", `${speed.data.text.length} 字符`);
    } else {
      fail("AI 写作 · 文档速读", speed.data?.error || `status=${speed.status}`);
    }
  } else {
    skip("AI 写作生成", "未配置 DeepSeek/ARK");
  }

  const eraseNoImage = await postJson("/api/ark-image/erase", { level: "standard" });
  if (eraseNoImage.status === 400) ok("图像 · AI 消除路由", "参数校验正常");
  else skip("图像 · AI 消除路由", `status=${eraseNoImage.status}`);

  const ocrNoImage = await postJson("/api/ark-image/ocr", {});
  if (ocrNoImage.status === 400 || ocrNoImage.status === 503) {
    ok("图像 · OCR 路由", `status=${ocrNoImage.status}`);
  } else {
    skip("图像 · OCR 路由", `status=${ocrNoImage.status}`);
  }

  const pages = [
    "/tools/image-studio?tab=erase",
    "/tools/image-studio?tab=ocr",
    "/tools/image-studio?tab=idphoto",
    "/tools/doc-convert",
    "/tools/ai-writer",
  ];
  for (const [p, label] of pages.map((x) => [x, x])) {
    const res = await fetch(`${BASE}${p}`);
    if (res.status === 200) ok(`页面 · ${label}`);
    else fail(`页面 · ${label}`, `status=${res.status}`);
  }

  console.log(`\n${passed} 通过, ${failed} 失败, ${skipped} 跳过\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  fail("测试异常", e.message);
  process.exit(1);
});
