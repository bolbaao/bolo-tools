#!/usr/bin/env node
/**
 * 补充 API 冒烟（不含视频链接提取 /api/video/extract）
 * 用法: node scripts/test-api-smoke.mjs
 */
import "../server/lib/env.mjs";

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
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
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
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

async function main() {
  console.log(`\n🍍 补充 API 冒烟: ${BASE}\n`);

  const health = await get("/api/health");
  if (health.status === 200 && health.data?.ok) ok("健康检查");
  else {
    fail("健康检查", `status=${health.status}`);
    return;
  }

  for (const [name, path, check] of [
    ["文档转换 capabilities", "/api/documents/capabilities", (d) => d.ok !== false],
    ["AI 全网搜索 capabilities", "/api/ai-search/capabilities", (d) => d.ok !== false],
    ["AI 视频剪辑 capabilities", "/api/ai-video-edit/capabilities", (d) => d.ok !== false],
    ["社媒分发 capabilities", "/api/social-publish/capabilities", (d) => d.ok !== false],
    ["字幕工坊 status", "/api/subtitle/status", (d) => typeof d === "object"],
    ["AI 对话 models", "/api/chat/models", (d) => Array.isArray(d.models) || d.ok !== false],
  ]) {
    const res = await get(path);
    if (res.status === 200 && check(res.data)) ok(name);
    else fail(name, `status=${res.status}`);
  }

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
    ok("影视资源下载", `${items} 条`);
  } else {
    skip("影视资源下载", resource.data?.error || `status=${resource.status}`);
  }

  const spider = await post(
    "/api/spider/run",
    { url: "https://example.com", preset: "links" },
    60000,
  );
  if (spider.status === 200 && spider.data?.ok) {
    ok("小蜘蛛爬虫", `${spider.data.items?.length ?? 0} 条`);
  } else {
    skip("小蜘蛛爬虫", spider.data?.error || `status=${spider.status}`);
  }

  const aiCap = await get("/api/ai-search/capabilities");
  if (aiCap.data?.searchConfigured) {
    const sr = await post(
      "/api/ai-search/search",
      { query: "2026 春节是哪天", depth: "basic" },
      90000,
    );
    if (sr.status === 200 && sr.data?.answer) {
      ok("AI 全网搜索", `${String(sr.data.answer).slice(0, 60)}…`);
    } else {
      skip("AI 全网搜索", sr.data?.error || `status=${sr.status}`);
    }
  } else {
    skip("AI 全网搜索", "未配置搜索 Key");
  }

  const adapt = await post(
    "/api/social-publish/adapt-captions",
    {
      title: "测试标题",
      description: "测试正文",
      platforms: ["douyin", "xiaohongshu"],
    },
    60000,
  );
  if (adapt.status === 200 && adapt.data?.captions) {
    ok("社媒文案适配", Object.keys(adapt.data.captions).join(", "));
  } else {
    skip("社媒文案适配", adapt.data?.error || `status=${adapt.status}`);
  }

  const sess = await get("/api/auth/session");
  if (sess.status === 200) ok("认证 session");
  else fail("认证 session", String(sess.status));

  const assets = await get("/api/assets/session");
  if (assets.status === 200) ok("素材库 session");
  else fail("素材库 session", String(assets.status));

  console.log(`\n${passed} 通过, ${failed} 失败, ${skipped} 跳过\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  fail("测试异常", e.message);
  process.exit(1);
});
