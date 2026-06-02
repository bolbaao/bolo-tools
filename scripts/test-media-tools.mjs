#!/usr/bin/env node
/**
 * 文件类工具冒烟：文档转换、GIF、音乐转换
 * 用法: node scripts/test-media-tools.mjs
 */
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument, StandardFonts } from "pdf-lib";
import "../server/lib/env.mjs";

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

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

async function makePdfBuffer(text) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText(text, { x: 72, y: 700, size: 14, font });
  return Buffer.from(await pdf.save());
}

async function makeTestVideo(outPath) {
  const { runFfmpeg } = await import("../server/lib/ffmpeg-run.mjs");
  await runFfmpeg([
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=red:s=160x120:d=1.5",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=1.5",
    "-shortest",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    outPath,
  ]);
}

async function makeTestAudio(outPath) {
  const { runFfmpeg } = await import("../server/lib/ffmpeg-run.mjs");
  await runFfmpeg([
    "-y",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=880:duration=1",
    "-c:a",
    "libmp3lame",
    outPath,
  ]);
}

async function postMultipart(urlPath, form) {
  const res = await fetch(`${BASE}${urlPath}`, { method: "POST", body: form });
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data, buffer: null, contentType: ct };
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  return { status: res.status, data: null, buffer, contentType: ct };
}

async function main() {
  console.log(`\n🍍 文件类工具测试: ${BASE}\n`);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pineapple-tools-"));

  try {
    const health = await fetch(`${BASE}/api/health`).then((r) => r.json()).catch(() => ({}));
    if (!health?.ok) {
      fail("健康检查", "服务未就绪");
      return;
    }
    ok("健康检查");

    const pdfBuf = await makePdfBuffer("Doc convert smoke TEST-999");
    const pdfForm = new FormData();
    pdfForm.append("mode", "pdf-to-images");
    pdfForm.append("scale", "1");
    pdfForm.append("imageFormat", "png");
    pdfForm.append("files", new Blob([pdfBuf], { type: "application/pdf" }), "test.pdf");

    const docRes = await postMultipart("/api/documents/convert", pdfForm);
    if (docRes.status === 200 && docRes.buffer?.length > 100) {
      ok("文档转换 · PDF 转图片", `${docRes.buffer.length} bytes`);
    } else {
      fail("文档转换 · PDF 转图片", docRes.data?.error || `status=${docRes.status}`);
    }

    const videoPath = path.join(tmpDir, "clip.mp4");
    await makeTestVideo(videoPath);
    const videoBuf = fs.readFileSync(videoPath);

    const gifForm = new FormData();
    gifForm.append("file", new Blob([videoBuf], { type: "video/mp4" }), "clip.mp4");
    gifForm.append("start", "0");
    gifForm.append("duration", "1");
    gifForm.append("fps", "8");
    gifForm.append("width", "120");

    const gifRes = await postMultipart("/api/gif/from-video", gifForm);
    if (gifRes.status === 200 && gifRes.buffer?.length > 100) {
      ok("GIF 动图", `${gifRes.buffer.length} bytes`);
    } else {
      fail("GIF 动图", gifRes.data?.error || `status=${gifRes.status}`);
    }

    const audioPath = path.join(tmpDir, "tone.mp3");
    await makeTestAudio(audioPath);
    const audioBuf = fs.readFileSync(audioPath);

    const audioForm = new FormData();
    audioForm.append("file", new Blob([audioBuf], { type: "audio/mpeg" }), "tone.mp3");
    audioForm.append("format", "wav");

    const audioRes = await postMultipart("/api/audio/convert", audioForm);
    if (audioRes.status === 200 && audioRes.buffer?.length > 100) {
      ok("音乐工坊 · MP3 转 WAV", `${audioRes.buffer.length} bytes`);
    } else {
      fail("音乐工坊 · MP3 转 WAV", audioRes.data?.error || `status=${audioRes.status}`);
    }

    const spider = await fetch(`${BASE}/api/spider/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com",
        listSelector: "body",
        itemSelector: "h1, p, a",
        limit: 5,
      }),
    }).then((r) => r.json().catch(() => ({})));

    if (spider?.ok && Array.isArray(spider.items)) {
      ok("小蜘蛛爬虫", `${spider.items.length} 条`);
    } else {
      skip("小蜘蛛爬虫", spider?.error || "无结果");
    }

    const resource = await fetch(`${BASE}/api/media/resource-search?q=肖申克`)
      .then((r) => r.json().catch(() => ({})));
    if (resource?.ok && Array.isArray(resource.sections)) {
      ok("影视资源下载", `${resource.sections.length} 个来源`);
    } else {
      skip("影视资源下载", resource?.error || "无结果");
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log(`\n${passed} 通过, ${failed} 失败, ${skipped} 跳过\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  fail("测试异常", e.message);
  process.exit(1);
});
