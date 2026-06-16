#!/usr/bin/env node
/**
 * 分镜生图端到端测试
 * 用法: node scripts/test-storyboard.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import "../server/lib/env.mjs";
import { createUserSessionToken } from "../server/lib/user-auth.mjs";
import {
  deleteStoryboardProject,
  listStoryboardProjects,
  saveStoryboardProject,
} from "../server/lib/storyboard-projects.mjs";

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

async function get(urlPath, cookie) {
  const res = await fetch(`${BASE}${urlPath}`, { headers: authHeaders(cookie) });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function post(urlPath, body, cookie, timeoutMs = 600000) {
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

async function testProjectCrud(userId) {
  console.log("\n— 分镜项目 CRUD（本地存储）—");
  try {
    const project = saveStoryboardProject(userId, {
      title: "测试项目",
      topic: "测试主题：手冲咖啡教程",
      style: "cinematic",
      aspectRatio: "9:16",
      sceneCount: 2,
      scenes: [
        {
          index: 1,
          title: "开场",
          narration: "今天教你做手冲",
          visual: "咖啡器具特写",
          imagePrompt: "coffee drip setup",
          imageBase64: Buffer.from("test").toString("base64"),
          mimeType: "image/png",
        },
      ],
    });
    if (!project.id) throw new Error("save 无 id");
    ok("保存项目");

    const listed = listStoryboardProjects(userId);
    if (!listed.some((p) => p.id === project.id)) throw new Error("list 未包含新项目");
    ok("列出项目", `${listed.length} 个`);

    deleteStoryboardProject(userId, project.id);
    if (listStoryboardProjects(userId).some((p) => p.id === project.id)) {
      throw new Error("delete 未生效");
    }
    ok("删除项目");
  } catch (e) {
    fail("分镜项目 CRUD", e.message);
  }
}

async function main() {
  console.log(`\n🍍 分镜生图测试: ${BASE}\n`);

  const health = await get("/api/health");
  if (health.status !== 200 || !health.data?.ok) {
    fail("服务健康检查", `status=${health.status}`);
    return;
  }
  ok("服务健康检查");

  const anon = await get("/api/storyboard/capabilities");
  if (anon.status === 200 && anon.data?.ok) ok("未登录 capabilities 可访问");
  else fail("未登录 capabilities", `status=${anon.status}`);

  const anonProjects = await get("/api/storyboard/projects");
  if (anonProjects.status === 401) ok("未登录 projects 返回 401");
  else fail("未登录 projects", `status=${anonProjects.status}`);

  const userId = loadVerifiedUserId();
  const token = userId ? createUserSessionToken(userId) : null;

  if (userId) {
    await testProjectCrud(`test-storyboard-${randomUUID()}`);
  } else {
    skip("分镜项目 CRUD", "无已验证用户");
  }

  const caps = await get("/api/storyboard/capabilities", token || undefined);
  if (caps.status !== 200 || !caps.data?.ok) {
    fail("分镜 capabilities", `status=${caps.status} ${caps.data?.error || ""}`);
    return;
  }

  if (!caps.data.ready) {
    skip(
      "分镜生成",
      !caps.data.aiConfigured
        ? "未配置 DeepSeek"
        : !caps.data.imageConfigured
          ? "未配置 ARK_API_KEY"
          : "服务未就绪",
    );
    return;
  }

  ok(
    "分镜 capabilities",
    `${caps.data.styles?.length || 0} 种风格 · ${caps.data.aspectRatios?.join(", ") || "—"}`,
  );

  console.log("\n— 测试分镜生成（2 镜，缩短耗时）—");
  const result = await post(
    "/api/storyboard/generate",
    {
      topic: "一杯手冲咖啡的制作过程，温暖治愈风格",
      sceneCount: 2,
      aspectRatio: "9:16",
      style: "cinematic",
      resolution: "1k",
    },
    userId ? token : undefined,
  );

  if (result.status !== 200 || !result.data?.ok) {
    fail("分镜生成", `status=${result.status} ${result.data?.error || ""}`);
    return;
  }

  const scenes = result.data.scenes || [];
  if (scenes.length < 2) {
    fail("分镜生成", `镜头数不足: ${scenes.length}`);
    return;
  }

  for (const scene of scenes) {
    if (!scene.title || !scene.imagePrompt) {
      fail("分镜结构", `镜头 ${scene.index} 缺少标题或生图词`);
      return;
    }
    if (!scene.imageBase64 && !scene.imageUrl) {
      fail("分镜图片", `镜头 ${scene.index} 未返回图片`);
      return;
    }
  }

  const totalChars = scenes.reduce((sum, s) => sum + (s.imageBase64?.length || 0), 0);
  ok("分镜生成", `${result.data.title} · ${scenes.length} 镜 · 图片约 ${Math.round(totalChars / 1024)} KB`);

  if (!token) {
    skip("保存分镜项目", "无已验证用户");
    console.log("\n完成。\n");
    return;
  }

  const saved = await post(
    "/api/storyboard/projects",
    {
      title: result.data.title,
      topic: "一杯手冲咖啡的制作过程，温暖治愈风格",
      style: "cinematic",
      aspectRatio: "9:16",
      sceneCount: 2,
      scenes,
    },
    token,
    120000,
  );
  if (saved.status === 200 && saved.data?.project?.id) {
    ok("保存分镜项目", saved.data.project.title);
    await fetch(`${BASE}/api/storyboard/projects/${encodeURIComponent(saved.data.project.id)}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
  } else {
    fail("保存分镜项目", `status=${saved.status} ${saved.data?.error || ""}`);
  }

  console.log("\n完成。\n");
}

main().catch((e) => {
  fail("测试异常", e.message);
});
