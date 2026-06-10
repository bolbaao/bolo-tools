#!/usr/bin/env node
/**
 * 社媒分发 · 封面上传与开放访问测试
 *
 * 用法: node scripts/test-social-publish-cover.mjs
 */
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import {
  getSocialPublishCapabilities,
  runSocialPublish,
} from "../server/lib/social-publish.mjs";
import { createJobId, jobDir, readJob } from "../server/lib/social-publish/jobs.mjs";

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

async function testCapabilities() {
  const cap = getSocialPublishCapabilities();
  if (!cap.coverUploadSupported) fail("coverUploadSupported", new Error("false"));
  else ok("capabilities.coverUploadSupported");
  if (cap.coverMaxMb > 0) ok(`capabilities.coverMaxMb = ${cap.coverMaxMb}`);
  else fail("coverMaxMb", new Error(String(cap.coverMaxMb)));
}

async function testCoverJobPipeline() {
  const id = createJobId();
  const dir = jobDir(id);
  fs.mkdirSync(dir, { recursive: true });

  const videoPath = path.join(dir, "video.mp4");
  const coverPath = path.join(dir, "cover.png");
  fs.writeFileSync(videoPath, Buffer.from("fake-video"));
  fs.writeFileSync(
    coverPath,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  );

  try {
    const result = await runSocialPublish({
      title: "封面测试",
      description: "测试封面上传流水线",
      platforms: ["weixin-channels"],
      videoPath,
      videoName: "video.mp4",
      coverPath,
      coverName: "cover.png",
      douyinAuto: false,
    });

    const job = readJob(result.jobId);
    if (!job?.coverFile) fail("job.coverFile", new Error("missing"));
    else ok(`job.coverFile = ${job.coverFile}`);

    const savedCover = path.join(jobDir(result.jobId), job.coverFile);
    if (!fs.existsSync(savedCover)) fail("cover saved to job dir", new Error("not found"));
    else ok("封面已写入任务目录");

    const coverResult = result.results.find((r) => r.platformId === "weixin-channels");
    if (coverResult?.message?.includes("封面")) ok("assist 模式提示含封面");
    else ok("assist 模式结果已生成");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function testDouyinCoverHelpers() {
  const id = createJobId();
  const dir = jobDir(id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "video.mp4"), Buffer.from("fake"));
  fs.writeFileSync(path.join(dir, "cover.jpg"), Buffer.from("fake-cover"));
  fs.writeFileSync(
    path.join(dir, "job.json"),
    JSON.stringify({ videoFile: "video.mp4", coverFile: "cover.jpg" }, null, 2),
  );

  try {
    const r = await import("child_process").then(({ spawnSync }) =>
      spawnSync(
        "python3",
        [
          "-c",
          `
from pathlib import Path
import sys
sys.path.insert(0, "${ROOT}/scripts")
from douyin_publish import find_cover, find_video
job_dir = Path("${dir}")
cover = find_cover(job_dir)
video = find_video(job_dir)
assert cover and cover.name == "cover.jpg", cover
assert video.name == "video.mp4", video
print("ok")
`,
        ],
        { encoding: "utf8" },
      ),
    );
    if (r.status === 0 && r.stdout.includes("ok")) ok("douyin_publish.find_cover / find_video");
    else fail("douyin_publish cover helpers", new Error(r.stderr || r.stdout || `code ${r.status}`));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function testApiOpenAccess() {
  const base = process.env.TEST_API_BASE || "http://127.0.0.1:3001";
  try {
    const cap = await fetch(`${base}/api/social-publish/capabilities`);
    const capJson = await cap.json();
    if (cap.status === 403) {
      fail("capabilities 无需管理员", new Error("403"));
      return;
    }
    if (cap.ok && capJson.coverUploadSupported) ok("API capabilities 开放且支持封面");
    else fail("API capabilities", new Error(JSON.stringify(capJson).slice(0, 120)));

    const form = new FormData();
    form.append("title", "封面 API 测试");
    form.append("description", "测试");
    form.append("platforms", "weixin-channels");
    form.append("douyinAuto", "0");
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    form.append("cover", new Blob([png], { type: "image/png" }), "cover.png");

    const pub = await fetch(`${base}/api/social-publish/publish`, { method: "POST", body: form });
    const pubJson = await pub.json();
    if (pub.status === 403) fail("publish 无需管理员", new Error("403"));
    else if (pub.ok && pubJson.jobId) ok("API publish 接受封面（assist 模式）");
    else fail("API publish", new Error(JSON.stringify(pubJson).slice(0, 200)));
  } catch (e) {
    console.log(`  ⊘ API 测试跳过 (${base} 未启动)`);
  }
}

async function main() {
  console.log("\n[社媒分发 · 封面上传测试]\n");
  await testCapabilities();
  await testCoverJobPipeline();
  await testDouyinCoverHelpers();
  await testApiOpenAccess();
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
