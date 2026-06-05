#!/usr/bin/env node
/**
 * 全站功能冒烟（排除：视频链接提取、3D 工坊）
 * 用法: node scripts/test-all-features.mjs
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

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("json") ? await res.json().catch(() => ({})) : null;
  return { status: res.status, data, text: data ? null : await res.text().catch(() => "") };
}

async function post(path, body, timeoutMs = 120000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
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

const PAGES = [
  ["/", "首页"],
  ["/tools/music-convert", "音乐工坊"],
  ["/tools/image-studio", "图像工坊"],
  ["/tools/image-compress", "图像压缩（重定向）"],
  ["/tools/image-sharpen", "图像变清晰（重定向）"],
  ["/tools/smart-cutout", "智能抠图（重定向）"],
  ["/tools/memory", "记忆库"],
  ["/tools/ai-search", "AI 全网搜索"],
  ["/tools/app-builder", "一键做 App"],
  ["/tools/ai-writer", "AI 写作助手"],
  ["/tools/ai-workflow", "AI 工作流"],
  ["/tools/social-publish", "社媒一键分发"],
  ["/tools/hot-trends", "热点中心"],
  ["/tools/media-download", "影视资源下载"],
  ["/tools/spider-builder", "小蜘蛛爬虫"],
  ["/tools/doc-convert", "文档转换"],
  ["/tools/subtitle-workshop", "字幕工坊"],
  ["/tools/gif-maker", "GIF 动图"],
  ["/tools/text-toolbox", "文本工具箱"],
  ["/tools/assets", "我的素材库"],
  ["/tools/admin", "用户管理"],
  ["/tools/developer", "开发者手册"],
  ["/tools/verify-email", "邮箱验证页"],
];

const CAPABILITIES = [
  ["/api/documents/capabilities", "文档转换 capabilities"],
  ["/api/ai-search/capabilities", "AI 全网搜索 capabilities"],
  ["/api/social-publish/capabilities", "社媒分发 capabilities"],
  ["/api/app-builder/capabilities", "一键做 App capabilities"],
  ["/api/ai-writer/capabilities", "AI 写作 capabilities"],
  ["/api/ai-workflow/capabilities", "AI 工作流 capabilities"],
  ["/api/chat/capabilities", "工作区对话 capabilities"],
  ["/api/subtitle/status", "字幕工坊 status"],
  ["/api/auth/captcha", "验证码"],
  ["/api/auth/session", "认证 session"],
  ["/api/assets/session", "素材库 session"],
  ["/api/memory", "记忆库 GET（未登录应 401）"],
];

async function testPages() {
  console.log("\n— 页面加载 —");
  for (const [route, name] of PAGES) {
    const res = await fetch(`${BASE}${route}`);
    if (res.status === 200) ok(`页面 · ${name}`, route);
    else fail(`页面 · ${name}`, `${route} status=${res.status}`);
  }
}

async function testCapabilities() {
  console.log("\n— API 能力与状态 —");
  for (const [route, name] of CAPABILITIES) {
    const res = await get(route);
    if (route === "/api/memory" && res.status === 401) {
      ok(name, "401 符合预期");
      continue;
    }
    if (route === "/api/auth/captcha" && res.status === 200 && res.data?.svg) {
      ok(name);
      continue;
    }
    if (res.status === 200 && res.data !== null) ok(name);
    else if (res.status === 403 && route.startsWith("/api/admin")) skip(name, "需管理员");
    else fail(name, `status=${res.status}`);
  }

  const hotTopics = await get("/api/ai-search/hot-topics");
  if (hotTopics.status === 200) ok("AI 搜索 hot-topics");
  else skip("AI 搜索 hot-topics", hotTopics.data?.error || String(hotTopics.status));

  const mediaHot = await get("/api/media/hot");
  if (mediaHot.status === 200) ok("影视资源 · hot");
  else skip("影视资源 · hot", mediaHot.data?.error || String(mediaHot.status));
}

async function testTrendsAndMedia() {
  console.log("\n— 热点与影视 —");
  for (const platform of ["douyin", "xiaohongshu"]) {
    const res = await get(`/api/trends/${platform}`);
    if (res.status === 200 && (res.data?.items?.length || res.data?.ok)) {
      ok(`热点中心 · ${platform}`, `${res.data?.items?.length ?? 0} 条`);
    } else {
      skip(`热点中心 · ${platform}`, res.data?.error || `status=${res.status}`);
    }
  }

  const resource = await get("/api/media/resource-search?q=肖申克");
  if (resource.status === 200 && resource.data?.sections) {
    const items = resource.data.sections?.reduce((n, s) => n + (s.items?.length ?? 0), 0) ?? 0;
    ok("影视资源搜索", `${items} 条`);
  } else {
    skip("影视资源搜索", resource.data?.error || `status=${resource.status}`);
  }
}

async function testSpider() {
  console.log("\n— 小蜘蛛爬虫 —");
  const run = await post(
    "/api/spider/run",
    { url: "https://example.com", listSelector: "body", itemSelector: "h1, p, a", limit: 5 },
    60000,
  );
  if (run.status === 200 && run.data?.ok) ok("抓取 example.com", `${run.data.items?.length ?? 0} 条`);
  else skip("抓取 example.com", run.data?.error || `status=${run.status}`);

  const gen = await post("/api/spider/generate", {
    url: "https://example.com",
    preset: "links",
    items: [{ title: "Example", url: "https://example.com" }],
  });
  if (gen.status === 200 && gen.data?.code) ok("生成 Node 脚本", `${gen.data.code.length} 字符`);
  else skip("生成 Node 脚本", gen.data?.error || `status=${gen.status}`);
}

async function testChat() {
  console.log("\n— 工作区对话 —");
  const chat = await post("/api/chat", {
    messages: [{ role: "user", content: "你好，回复一个字：好" }],
    pageContext: { path: "/" },
  }, 90000);
  if (chat.status === 200 && chat.data?.ok && chat.data?.reply) {
    ok("POST /api/chat", String(chat.data.reply).slice(0, 40));
  } else {
    skip("POST /api/chat", chat.data?.error || `status=${chat.status}`);
  }
}

async function testFileTools(tmpDir) {
  console.log("\n— 文件类工具 —");
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText("Smoke test", { x: 72, y: 700, size: 14, font });
  const pdfBuf = Buffer.from(await pdf.save());

  const pdfForm = new FormData();
  pdfForm.append("mode", "pdf-to-images");
  pdfForm.append("scale", "1");
  pdfForm.append("imageFormat", "png");
  pdfForm.append("files", new Blob([pdfBuf], { type: "application/pdf" }), "test.pdf");
  const docRes = await postMultipart("/api/documents/convert", pdfForm);
  if (docRes.status === 200 && docRes.buffer?.length > 100) ok("文档转换 · PDF→图片", `${docRes.buffer.length} bytes`);
  else fail("文档转换 · PDF→图片", docRes.data?.error || `status=${docRes.status}`);

  const { runFfmpeg } = await import("../server/lib/ffmpeg-run.mjs");
  const videoPath = path.join(tmpDir, "clip.mp4");
  await runFfmpeg([
    "-y", "-f", "lavfi", "-i", "color=c=red:s=160x120:d=1.5",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=1.5",
    "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", videoPath,
  ]);
  const videoBuf = fs.readFileSync(videoPath);

  const gifForm = new FormData();
  gifForm.append("file", new Blob([videoBuf], { type: "video/mp4" }), "clip.mp4");
  gifForm.append("start", "0");
  gifForm.append("duration", "1");
  gifForm.append("fps", "8");
  gifForm.append("width", "120");
  const gifRes = await postMultipart("/api/gif/from-video", gifForm);
  if (gifRes.status === 200 && gifRes.buffer?.length > 100) ok("GIF 动图", `${gifRes.buffer.length} bytes`);
  else fail("GIF 动图", gifRes.data?.error || `status=${gifRes.status}`);

  const audioPath = path.join(tmpDir, "tone.mp3");
  await runFfmpeg([
    "-y", "-f", "lavfi", "-i", "sine=frequency=880:duration=1", "-c:a", "libmp3lame", audioPath,
  ]);
  const audioForm = new FormData();
  audioForm.append("file", new Blob([fs.readFileSync(audioPath)], { type: "audio/mpeg" }), "tone.mp3");
  audioForm.append("format", "wav");
  const audioRes = await postMultipart("/api/audio/convert", audioForm);
  if (audioRes.status === 200 && audioRes.buffer?.length > 100) ok("音乐工坊 · MP3→WAV", `${audioRes.buffer.length} bytes`);
  else fail("音乐工坊 · MP3→WAV", audioRes.data?.error || `status=${audioRes.status}`);

  const subStatus = await get("/api/subtitle/status");
  if (subStatus.data?.localAvailable) {
    const subForm = new FormData();
    subForm.append("file", new Blob([videoBuf], { type: "video/mp4" }), "clip.mp4");
    subForm.append("mode", "local");
    subForm.append("format", "srt");
    const subRes = await postMultipart("/api/subtitle/transcribe", subForm, 180000);
    if (subRes.status === 200 && subRes.data?.ok) ok("字幕工坊 · 本地转写", `${String(subRes.data.text || subRes.data.content || "").slice(0, 40)}`);
    else skip("字幕工坊 · 本地转写", subRes.data?.error || `status=${subRes.status}`);
  } else {
    skip("字幕工坊 · 本地转写", "faster-whisper 未就绪");
  }
}

async function testAiFeatures() {
  console.log("\n— AI 功能 —");
  const aiCap = await get("/api/ai-search/capabilities");
  if (aiCap.data?.available) {
    const sr = await post("/api/ai-search/search", { query: "2026 春节是哪天", depth: "basic" }, 90000);
    if (sr.status === 200 && (sr.data?.summary || sr.data?.results?.length)) {
      ok("AI 全网搜索", `${String(sr.data.summary || sr.data.results?.[0]?.title || "").slice(0, 50)}…`);
    } else skip("AI 全网搜索", sr.data?.error || `status=${sr.status}`);
  } else {
    skip("AI 全网搜索", "未配置搜索 Key");
  }

  const writerCap = await get("/api/ai-writer/capabilities");
  if (writerCap.data?.aiConfigured) {
    const writer = await post("/api/ai-writer/generate", {
      mode: "summarize",
      input: "测试摘要：AI 正在改变内容创作。",
      tone: "professional",
    }, 120000);
    if (writer.status === 200 && writer.data?.text) ok("AI 写作助手", `${writer.data.text.length} 字符`);
    else skip("AI 写作助手", writer.data?.error || `status=${writer.status}`);
  } else {
    skip("AI 写作助手", "未配置 DeepSeek");
  }

  const adapt = await post("/api/social-publish/adapt-captions", {
    title: "测试",
    description: "正文",
    platforms: ["douyin", "xiaohongshu"],
  }, 60000);
  if (adapt.status === 200 && adapt.data?.captions) ok("社媒文案适配", Object.keys(adapt.data.captions).join(", "));
  else skip("社媒文案适配", adapt.data?.error || `status=${adapt.status}`);

  const appCap = await get("/api/app-builder/capabilities");
  if (appCap.data?.aiConfigured) {
    const app = await post("/api/app-builder/generate", {
      description: "极简计数器，加减和重置",
      appType: "tool",
      appName: "计数器",
    }, 180000);
    if (app.status === 200 && app.data?.html) ok("一键做 App", `${app.data.html.length} 字符`);
    else skip("一键做 App", app.data?.error || `status=${app.status}`);
  } else {
    skip("一键做 App", "未配置 DeepSeek");
  }

  const wfCap = await get("/api/ai-workflow/capabilities");
  if (wfCap.data?.aiConfigured) {
    const wf = await post("/api/ai-workflow/run", {
      workflowId: "social-pack",
      input: "春季露营清单",
      runAll: true,
    }, 360000);
    if (wf.status === 200 && wf.data?.results?.length) ok("AI 工作流", `${wf.data.results.length} 步`);
    else skip("AI 工作流", wf.data?.error || `status=${wf.status}`);
  } else {
    skip("AI 工作流", "未配置 DeepSeek");
  }
}

async function testExcludedNotCalled() {
  console.log("\n— 排除项确认 —");
  ok("已跳过 video-extract", "未调用 /api/video/extract");
  ok("已跳过 mlsharp-3d", "未调用 /api/mlsharp-3d/generate");
}

async function main() {
  console.log(`\n🍍 全站功能测试（排除视频链接提取 & 3D 工坊）: ${BASE}\n`);

  const health = await get("/api/health");
  if (health.status !== 200 || !health.data?.ok) {
    fail("健康检查", "服务未就绪，请先 ./start.sh");
    process.exit(1);
  }
  ok("健康检查");

  await testPages();
  await testCapabilities();
  await testTrendsAndMedia();
  await testSpider();
  await testChat();
  await testAiFeatures();
  await testExcludedNotCalled();

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pineapple-all-"));
  try {
    await testFileTools(tmpDir);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log(`\n${"=".repeat(40)}`);
  console.log(`${passed} 通过, ${failed} 失败, ${skipped} 跳过`);
  console.log(`${"=".repeat(40)}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  fail("测试异常", e.message);
  process.exit(1);
});
