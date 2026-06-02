#!/usr/bin/env node
/**
 * 端到端冒烟测试：一键做 App 等 AI 功能
 * 用法: node scripts/test-new-features.mjs
 */
import "../server/lib/env.mjs";

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";

async function post(path, body, timeoutMs = 180000) {
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

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function ok(label, detail) {
  console.log(`✅ ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label, detail) {
  console.error(`❌ ${label}${detail ? ` — ${detail}` : ""}`);
  process.exitCode = 1;
}

async function main() {
  console.log(`\n🍍 测试目标: ${BASE}\n`);

  const health = await get("/api/health");
  if (health.status !== 200 || !health.data?.ok) {
    fail("服务健康检查", `status=${health.status}`);
    return;
  }
  ok("服务健康检查");

  const appCaps = await get("/api/app-builder/capabilities");
  if (appCaps.status !== 200 || !appCaps.data?.aiConfigured) {
    fail("一键做 App capabilities", JSON.stringify(appCaps.data));
  } else {
    ok("一键做 App capabilities", `${appCaps.data.appTypes?.length || 0} 种类型`);
  }

  console.log("\n— 测试一键做 App —");
  const app = await post(
    "/api/app-builder/generate",
    {
      description: "做一个极简计数器，有加减按钮和重置，深色主题",
      appType: "tool",
      appName: "计数器",
    },
    180000,
  );
  if (app.status !== 200 || !app.data?.ok || !app.data.html) {
    fail("一键做 App generate", `status=${app.status} ${app.data?.error || ""}`);
  } else {
    const html = app.data.html;
    const valid = /<!DOCTYPE\s+html/i.test(html) || /<html[\s>]/i.test(html);
    if (!valid) fail("一键做 App generate", "HTML 无效");
    else ok("一键做 App generate", `${app.data.title} (${html.length} 字符)`);
  }

  console.log("\n— 测试 AI 写作助手 —");
  const writer = await post(
    "/api/ai-writer/generate",
    { mode: "summarize", input: "人工智能正在改变内容创作。工具越来越智能，但人类的创意和判断仍然不可替代。", tone: "professional" },
    120000,
  );
  if (writer.status !== 200 || !writer.data?.ok || !writer.data.text) {
    fail("AI 写作助手 generate", `status=${writer.status} ${writer.data?.error || ""}`);
  } else {
    ok("AI 写作助手 generate", `${writer.data.text.length} 字符`);
  }

  console.log("\n— 测试 AI 工作流 —");
  const workflow = await post(
    "/api/ai-workflow/run",
    {
      workflowId: "social-pack",
      input: "春季露营装备清单，面向都市年轻人",
      runAll: true,
    },
    360000,
  );
  if (workflow.status !== 200 || !workflow.data?.ok || !workflow.data.results?.length) {
    fail("AI 工作流 run", `status=${workflow.status} ${workflow.data?.error || ""}`);
  } else {
    ok("AI 工作流 run", `${workflow.data.results.length} 步 · ${workflow.data.completed ? "完成" : "进行中"}`);
  }

  console.log("\n完成。\n");
}

main().catch((e) => {
  fail("测试异常", e.message);
});
