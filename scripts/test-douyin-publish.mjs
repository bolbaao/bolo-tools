#!/usr/bin/env node
/**
 * 抖音全自动发布 · 冒烟测试（默认不真发，仅测登录与上传页）
 *
 * 用法:
 *   node scripts/test-douyin-publish.mjs
 *   DOUYIN_PUBLISH_E2E=1 node scripts/test-douyin-publish.mjs   # 含真实上传（需小视频，仍不点发布）
 */
import fs from "fs";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { getSocialPublishCapabilities } from "../server/lib/social-publish.mjs";
import { isDouyinAutomationEnabled } from "../server/lib/social-publish/douyin.mjs";
import { getAccountStatus } from "../server/lib/social-publish/accounts.mjs";
import { getPlatform } from "../server/lib/social-publish/platforms.mjs";
import { createJobId, jobDir, writeJob } from "../server/lib/social-publish/jobs.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

let passed = 0;
let failed = 0;

function ok(name) {
  passed++;
  console.log(`✓ ${name}`);
}

function fail(name, err) {
  failed++;
  console.error(`✗ ${name}:`, err?.message || err);
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      env: { ...process.env, ...opts.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
    });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("timeout"));
    }, opts.timeoutMs ?? 120000);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.on("error", reject);
  });
}

async function testLib() {
  const cap = getSocialPublishCapabilities();
  if (!cap.douyinAutoEnabled) fail("douyinAutoEnabled", new Error("应为 true"));
  else ok("douyinAutoEnabled 默认开启");

  const platform = getPlatform("douyin");
  if (!platform?.creatorUrl) fail("douyin platform", new Error("missing"));
  else ok("抖音平台配置");

  const acc = getAccountStatus(platform);
  if (!acc.ready) {
    console.log("  ⚠ 抖音账号未就绪:", acc.hint);
  } else ok(`抖音账号就绪 (${acc.cookiePath || acc.hint})`);

  if (!isDouyinAutomationEnabled()) fail("isDouyinAutomationEnabled", new Error("false"));
  else ok("isDouyinAutomationEnabled()");
}

async function testPlaywrightImport() {
  const r = await run("python3", ["-c", "import playwright; print('ok')"], { timeoutMs: 15000 });
  if (r.code === 0 && r.stdout.includes("ok")) ok("python playwright 模块");
  else fail("python playwright 模块", new Error(r.stderr || r.stdout || `code ${r.code}`));
}

async function testLoginSmoke() {
  const script = path.join(ROOT, "scripts", "douyin_publish_smoke.py");
  if (!fs.existsSync(script)) {
    fail("douyin_publish_smoke.py", new Error("missing"));
    return;
  }
  const r = await run("python3", [script], {
    timeoutMs: 180000,
    env: {
      SOCIAL_PUBLISH_HEADED: "0",
      DOUYIN_PUBLISH_REFRESH_COOKIES: "0",
      PLAYWRIGHT_BROWSERS_PATH: path.join(ROOT, ".local", "ms-playwright"),
    },
  });
  const line = r.stdout.trim().split("\n").pop();
  let data = {};
  try {
    data = JSON.parse(line || "{}");
  } catch {
    fail("登录冒烟", new Error(r.stderr || r.stdout || `exit ${r.code}`));
    return;
  }
  if (data.ok) ok(`创作者中心登录冒烟: ${data.message}`);
  else fail("创作者中心登录冒烟", new Error(data.error || r.stderr));
}

async function testUploadDryRun() {
  if (process.env.DOUYIN_PUBLISH_E2E !== "1") {
    console.log("  ⊘ 跳过上传 E2E（设置 DOUYIN_PUBLISH_E2E=1 启用）");
    return;
  }
  const { runFfmpeg } = await import("../server/lib/ffmpeg-run.mjs");
  const id = createJobId();
  const dir = jobDir(id);
  fs.mkdirSync(dir, { recursive: true });
  const videoPath = path.join(dir, "video.mp4");
  try {
    await runFfmpeg([
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=blue:s=320x240:d=2",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=2",
      "-shortest",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      videoPath,
    ]);
    writeJob({
      id,
      title: "春雨集测试",
      description: "自动化测试，请勿推广",
      tags: "测试",
      platforms: ["douyin"],
      captions: {
        douyin: JSON.stringify({
          title: "春雨集测试",
          description: "自动化测试稿件",
        }),
      },
    });
    const r = await run(
      "python3",
      [path.join(ROOT, "scripts", "douyin_publish.py"), "--job-dir", dir, "--dry-run"],
      { timeoutMs: 600000, env: { DOUYIN_PUBLISH_AUTO_CONFIRM: "0" } },
    );
    const line = r.stdout.trim().split("\n").pop();
    const data = JSON.parse(line || "{}");
    if (data.ok) ok(`上传填表 dry-run: ${data.message}`);
    else fail("上传填表 dry-run", new Error(data.error));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function testApi(base) {
  const health = await fetch(`${base}/api/health`);
  if (!health.ok) {
    fail("API health", new Error(String(health.status)));
    return;
  }
  ok("API /api/health");

  const cap = await fetch(`${base}/api/social-publish/capabilities`);
  const capJson = await cap.json();
  if (capJson.douyinAutoEnabled) ok("API capabilities.douyinAutoEnabled");
  else fail("API capabilities", new Error("douyinAutoEnabled false"));

  const form = new FormData();
  form.append("title", "测试");
  form.append("description", "测试");
  form.append("platforms", "douyin");
  form.append("douyinAuto", "1");
  const pub = await fetch(`${base}/api/social-publish/publish`, { method: "POST", body: form });
  const pubJson = await pub.json();
  if (pub.status === 400 && /视频/.test(pubJson.error || "")) {
    ok("API 无视频时返回 400");
  } else {
    fail("API 无视频校验", new Error(JSON.stringify(pubJson).slice(0, 200)));
  }
}

async function main() {
  console.log("\n[抖音全自动 · 冒烟测试]\n");

  await testLib();
  await testPlaywrightImport();
  await testLoginSmoke();
  await testUploadDryRun();

  const apiBase = process.env.TEST_API_BASE || "http://127.0.0.1:3001";
  try {
    await testApi(apiBase);
  } catch (e) {
    console.log(`  ⊘ API 测试跳过 (${apiBase} 未启动，可先 npm run dev:api)`);
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
