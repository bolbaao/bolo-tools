#!/usr/bin/env node
/**
 * AI 视频剪辑：单元 + ffmpeg 集成测试（无需 API Key）
 * 用法：node scripts/test-ai-video-edit.mjs
 */
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import {
  normalizeEditPlan,
  prepareVideoInput,
  probeVideo,
  renderEditedVideo,
} from "../server/lib/ai-video-edit.mjs";
import {
  normalizeVoiceoverPlan,
  probeClipLibrary,
  renderVoiceoverVideo,
} from "../server/lib/ai-voiceover.mjs";
import { getFfmpegPath } from "../server/lib/ffmpeg-bin.mjs";
import { isEdgeTtsAvailable } from "../server/lib/edge-tts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

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

async function makeTestClip(outPath, color, duration = 2) {
  const { runFfmpeg } = await import("../server/lib/ffmpeg-run.mjs");
  await runFfmpeg([
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=${color}:s=320x240:d=${duration}`,
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=" + duration,
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    "28",
    "-c:a",
    "aac",
    "-shortest",
    outPath,
  ]);
}

async function testNormalize() {
  const meta = { duration: 10, width: 320, height: 240, hasAudio: true };
  const plan = normalizeEditPlan(
    {
      summary: "test",
      operations: [{ op: "trim", start: 1, end: 8 }, { op: "fade", type: "out", duration: 1 }],
    },
    meta,
  );
  if (plan.operations.length !== 2) throw new Error("expected 2 ops");
  ok("normalizeEditPlan");
}

async function testSingleAndMulti() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pineapple-aivid-test-"));
  try {
    const a = path.join(tmpDir, "a.mp4");
    const b = path.join(tmpDir, "b.mp4");
    await makeTestClip(a, "red");
    await makeTestClip(b, "blue");

    const single = await prepareVideoInput([a], tmpDir);
    if (!single.inputPath || single.clips.length !== 1) throw new Error("single prepare failed");
    ok("prepareVideoInput 单文件");

    const multi = await prepareVideoInput([a, b], tmpDir, [
      { originalname: "a.mp4" },
      { originalname: "b.mp4" },
    ]);
    if (!multi.multi || multi.clips.length !== 2) throw new Error("multi clips meta");
    const mergedMeta = await probeVideo(multi.inputPath);
    const expectedDur = single.clips[0].duration + multi.clips[1].duration;
    if (Math.abs(mergedMeta.duration - expectedDur) > 0.5) {
      throw new Error(`merged duration ${mergedMeta.duration} vs expected ~${expectedDur}`);
    }
    ok("prepareVideoInput 多文件拼接");

    const plan = normalizeEditPlan(
      { summary: "trim test", operations: [{ op: "trim", start: 0, end: 3 }] },
      mergedMeta,
    );
    const out = path.join(tmpDir, "out.mp4");
    await renderEditedVideo({
      inputPath: multi.inputPath,
      outputPath: out,
      plan,
      meta: mergedMeta,
    });
    if (!fs.existsSync(out) || fs.statSync(out).size < 1000) throw new Error("output missing");
    ok("renderEditedVideo 拼接后裁剪");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function testVoiceover() {
  if (!isEdgeTtsAvailable()) {
    console.log("⊘ voiceover 跳过（未安装 edge-tts）");
    return;
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pineapple-vo-test-"));
  try {
    const a = path.join(tmpDir, "a.mp4");
    const b = path.join(tmpDir, "b.mp4");
    await makeTestClip(a, "green", 2);
    await makeTestClip(b, "blue", 2);
    const clips = await probeClipLibrary([a, b]);
    const plan = normalizeVoiceoverPlan(
      {
        summary: "口播测试",
        voice: "zh-CN-XiaoxiaoNeural",
        aspect: "16:9",
        segments: [
          { text: "测试口播。", clipIndex: 0, clipStart: 0, clipEnd: 1.2 },
          { text: "下一段。", clipIndex: 1, clipStart: 0, clipEnd: 1.2 },
        ],
      },
      clips,
    );
    const out = path.join(tmpDir, "voiceover.mp4");
    await renderVoiceoverVideo({ plan, clips, tmpDir, outputPath: out });
    if (!fs.existsSync(out) || fs.statSync(out).size < 1000) throw new Error("voiceover output invalid");
    ok("AI 剪口播 人声合成+拼接");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function main() {
  console.log("ffmpeg:", getFfmpegPath());
  await testNormalize();
  await testSingleAndMulti();
  await testVoiceover();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
