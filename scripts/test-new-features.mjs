#!/usr/bin/env node
/**
 * 端到端冒烟测试：AI 写作、分镜生图等功能
 * 用法: node scripts/test-new-features.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "../server/lib/env.mjs";
import { createUserSessionToken } from "../server/lib/user-auth.mjs";

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERS_PATH = path.join(__dirname, "..", "data", "users", "users.json");

function loadVerifiedUserId() {
  if (!fs.existsSync(USERS_PATH)) return null;
  try {
    const users = JSON.parse(fs.readFileSync(USERS_PATH, "utf8"));
    const hit = users.find((u) => u.emailVerified || u.isAdmin);
    return hit?.id || users[0]?.id || null;
  } catch {
    return null;
  }
}

function authHeaders(cookie) {
  return cookie ? { Cookie: `user_session=${cookie}` } : {};
}

async function post(urlPath, body, timeoutMs = 180000, cookie) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${urlPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(cookie) },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

async function get(urlPath, cookie) {
  const res = await fetch(`${BASE}${urlPath}`, { headers: authHeaders(cookie) });
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

function skip(label, reason) {
  console.log(`○ ${label} — 跳过: ${reason}`);
}

async function main() {
  console.log(`\n🍍 测试目标: ${BASE}\n`);

  const health = await get("/api/health");
  if (health.status !== 200 || !health.data?.ok) {
    fail("服务健康检查", `status=${health.status}`);
    return;
  }
  ok("服务健康检查");

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

  console.log("\n— 测试分镜生图 —");
  const userId = loadVerifiedUserId();
  if (!userId) {
    skip("分镜生图", "无已验证用户");
  } else {
    const token = createUserSessionToken(userId);
    const sbCaps = await get("/api/storyboard/capabilities", token);
    if (!sbCaps.data?.ready) {
      skip(
        "分镜生图",
        !sbCaps.data?.aiConfigured ? "未配置 DeepSeek" : "未配置 ARK_API_KEY",
      );
    } else {
      ok("分镜生图 capabilities", `${sbCaps.data.styles?.length || 0} 种风格`);
      const sb = await post(
        "/api/storyboard/generate",
        {
          topic: "一杯手冲咖啡的制作过程，温暖治愈风格",
          sceneCount: 2,
          aspectRatio: "9:16",
          style: "cinematic",
        },
        600000,
        token,
      );
      if (sb.status !== 200 || !sb.data?.ok || !sb.data.scenes?.length) {
        fail("分镜生图 generate", `status=${sb.status} ${sb.data?.error || ""}`);
      } else {
        const withImage = sb.data.scenes.filter((s) => s.imageBase64 || s.imageUrl).length;
        ok("分镜生图 generate", `${sb.data.title} · ${withImage}/${sb.data.scenes.length} 镜有图`);
      }
    }
  }

  console.log("\n完成。\n");
}

main().catch((e) => {
  fail("测试异常", e.message);
});
