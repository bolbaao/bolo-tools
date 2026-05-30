#!/usr/bin/env node
/**
 * 批量测试视频链接提取各平台
 * 用法: node scripts/test-video-platforms.mjs [baseUrl]
 */
const BASE = process.argv[2] || "http://127.0.0.1:3001";
const TIMEOUT_MS = 120_000;

/** 各平台公开测试链接 */
const SAMPLES = [
  { id: "douyin", url: "https://v.douyin.com/iRNBho6U/" },
  { id: "bilibili", url: "https://www.bilibili.com/video/BV1GJ411x7h7" },
  { id: "youtube", url: "https://www.youtube.com/watch?v=jNQXAC9IVRw" },
  { id: "twitter", url: "https://x.com/Twitter/status/1447929525663854592" },
  { id: "telegram", url: "https://t.me/s/telegram/193" },
  { id: "instagram", url: "https://www.instagram.com/reel/C0A0fake0000/" },
  { id: "tiktok", url: "https://www.tiktok.com/@scout2015/video/6718339390846714886" },
  { id: "facebook", url: "https://www.facebook.com/watch/?v=20531316728" },
  { id: "reddit", url: "https://www.reddit.com/r/videos/comments/6rrwyj/that_look_when_a_cat_knows_you_are_high/" },
  { id: "vimeo", url: "https://vimeo.com/148751763" },
  { id: "pinterest", url: "https://www.pinterest.com/pin/68745964953/" },
  { id: "threads", url: "https://www.threads.net/@zuck/post/C1fake0000000" },
  { id: "twitch", url: "https://clips.twitch.tv/SpicyPreciousDiamondBudStar" },
];

async function extractViaApi(url) {
  const res = await fetch(`${BASE}/api/video/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function testOne({ id, url }) {
  const start = Date.now();
  try {
    const data = await extractViaApi(url);
    const ms = Date.now() - start;
    return {
      id,
      ok: true,
      platform: data.platform,
      title: (data.title || "").slice(0, 60),
      formats: data.formats?.length || 0,
      ms,
    };
  } catch (e) {
    return {
      id,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      ms: Date.now() - start,
    };
  }
}

async function main() {
  console.log(`Testing ${SAMPLES.length} platforms via ${BASE}/api/video/extract\n`);
  const results = [];
  for (const sample of SAMPLES) {
    process.stdout.write(`  ${sample.id.padEnd(12)} … `);
    const r = await testOne(sample);
    results.push(r);
    if (r.ok) {
      console.log(`✓ ${r.formats} formats · ${r.title || "(no title)"} (${r.ms}ms)`);
    } else {
      console.log(`✗ ${r.error} (${r.ms}ms)`);
    }
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log("\nFailed:");
    for (const f of failed) console.log(`  - ${f.id}: ${f.error}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
