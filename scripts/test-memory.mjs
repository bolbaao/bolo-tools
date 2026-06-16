#!/usr/bin/env node
/**
 * 记忆库功能测试：CRUD、文件文本提取、文件上传 API
 * 用法: node scripts/test-memory.mjs
 */
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import "../server/lib/env.mjs";
import {
  addUserMemory,
  deleteUserMemory,
  listUserMemories,
  updateUserMemory,
} from "../server/lib/user-memory.mjs";
import { extractMemoryFileText } from "../server/lib/memory-file.mjs";
import { extractMemoriesFromFileContent } from "../server/lib/memory-extract.mjs";
import { createUserSessionToken } from "../server/lib/user-auth.mjs";

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERS_PATH = path.join(__dirname, "..", "data", "users", "users.json");

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

function loadVerifiedUserId() {
  if (!fs.existsSync(USERS_PATH)) return null;
  try {
    const users = JSON.parse(fs.readFileSync(USERS_PATH, "utf8"));
    const hit = users.find((u) => u.emailVerified);
    return hit?.id || users[0]?.id || null;
  } catch {
    return null;
  }
}

async function postMultipart(urlPath, form, cookie, timeoutMs = 120000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = cookie ? { Cookie: `user_session=${cookie}` } : {};
    const res = await fetch(`${BASE}${urlPath}`, {
      method: "POST",
      body: form,
      headers,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

async function testCrud() {
  console.log("\n— 记忆库 CRUD（本地存储）—");
  const userId = `test-memory-${randomUUID()}`;
  try {
    const created = addUserMemory(userId, "测试：喜欢简洁回答");
    if (!created.id) throw new Error("add 无 id");
    ok("添加记忆");

    const listed = listUserMemories(userId);
    if (!listed.some((m) => m.id === created.id)) throw new Error("list 未包含新记忆");
    ok("列出记忆", `${listed.length} 条`);

    const updated = updateUserMemory(userId, created.id, "测试：喜欢简洁、分点的回答");
    if (updated.content !== "测试：喜欢简洁、分点的回答") throw new Error("update 内容不符");
    ok("更新记忆");

    deleteUserMemory(userId, created.id);
    if (listUserMemories(userId).some((m) => m.id === created.id)) throw new Error("delete 未生效");
    ok("删除记忆");
  } catch (e) {
    fail("记忆库 CRUD", e.message);
  }
}

async function testFileTextExtract() {
  console.log("\n— 文件文本提取 —");
  const sample = `# 个人偏好\n- 我是前端开发者\n- 对海鲜过敏\n- 回答请用中文，简洁一些`;
  const tmp = path.join(os.tmpdir(), `memory-test-${Date.now()}.txt`);
  fs.writeFileSync(tmp, sample, "utf8");
  try {
    const buf = fs.readFileSync(tmp);
    const extracted = await extractMemoryFileText(buf, "profile.txt");
    if (!extracted.content.includes("前端开发者")) throw new Error("文本提取不完整");
    ok("txt 文本提取", `${extracted.content.length} 字`);
  } catch (e) {
    fail("txt 文本提取", e.message);
  } finally {
    fs.unlinkSync(tmp);
  }
}

async function testAiFileExtract() {
  console.log("\n— AI 从文件提取记忆 —");
  const userId = `test-memory-ai-${randomUUID()}`;
  const content = [
    "个人资料",
    "姓名：测试用户",
    "职业：产品经理",
    "偏好：回答尽量简短，列表呈现",
    "禁忌：不要推荐恐怖类影视",
  ].join("\n");

  try {
    const added = await extractMemoriesFromFileContent(userId, content, { filename: "profile.txt" });
    if (!added.length) throw new Error("未提取到记忆");
    ok("AI 文件记忆提取", `${added.length} 条`);
    for (const item of added) {
      deleteUserMemory(userId, item.id);
    }
  } catch (e) {
    if (/未配置 AI|503/.test(String(e.message))) {
      skip("AI 文件记忆提取", "未配置 DEEPSEEK_API_KEY");
    } else {
      fail("AI 文件记忆提取", e.message);
    }
  }
}

async function testHttpApi() {
  console.log("\n— 记忆库 HTTP API —");
  const anon = await fetch(`${BASE}/api/memory`);
  if (anon.status === 401) ok("未登录 GET /api/memory 返回 401");
  else fail("未登录 GET /api/memory", `status=${anon.status}`);

  const userId = loadVerifiedUserId();
  if (!userId) {
    skip("登录态文件上传", "无已验证用户");
    return;
  }

  const token = createUserSessionToken(userId);
  const sample = "个人偏好\n- 常用 VS Code\n- 喜欢深色主题\n- 回复请用中文";
  const form = new FormData();
  form.append("file", new Blob([sample], { type: "text/plain" }), "prefs.txt");

  const res = await postMultipart("/api/memory/extract-file", form, token);
  if (res.status === 200 && Array.isArray(res.data?.added) && res.data.added.length > 0) {
    ok("POST /api/memory/extract-file", `${res.data.added.length} 条`);
    for (const item of res.data.added) {
      await fetch(`${BASE}/api/memory/${encodeURIComponent(item.id)}`, {
        method: "DELETE",
        headers: { Cookie: `user_session=${token}` },
      });
    }
  } else if (res.status === 503) {
    skip("POST /api/memory/extract-file", res.data?.error || "AI 未配置");
  } else if (res.status === 422) {
    skip("POST /api/memory/extract-file", res.data?.error || "内容重复或未识别");
  } else {
    fail("POST /api/memory/extract-file", `status=${res.status} ${res.data?.error || ""}`);
  }
}

async function main() {
  console.log(`\n🍍 记忆库测试: ${BASE}\n`);

  const health = await fetch(`${BASE}/api/health`).then((r) => r.json()).catch(() => null);
  if (!health?.ok) {
    console.error("服务未启动，请先运行 ./start.sh");
    process.exit(1);
  }
  ok("服务健康检查");

  await testCrud();
  await testFileTextExtract();
  await testAiFileExtract();
  await testHttpApi();

  console.log(`\n结果: ${passed} 通过, ${failed} 失败, ${skipped} 跳过\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
