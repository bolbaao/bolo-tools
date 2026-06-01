#!/usr/bin/env node
/**
 * 微信视频号提取：单元测试 + 可选 API 集成测试
 * 用法:
 *   node scripts/test-weixin-channels.mjs
 *   node scripts/test-weixin-channels.mjs http://127.0.0.1:3001
 */
import {
  parseWeixinChannelsInput,
  cleanVideoUrl,
  buildFullMediaUrl,
  mapObjectDescToYtDlp,
} from "../server/lib/weixin-channels-extract.mjs";
import { decryptWeixinVideo } from "../server/lib/weixin-channels-decrypt.mjs";

const BASE = process.argv[2] || "http://127.0.0.1:3001";
let passed = 0;
let failed = 0;

function assert(name, cond, detail = "") {
  if (cond) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

function testParseInput() {
  console.log("\n[parseWeixinChannelsInput]");
  const a = parseWeixinChannelsInput(
    "https://channels.weixin.qq.com/web/pages/feed?exportkey=ABC&oid=123&nid=456_0_0",
  );
  assert("解析 oid/nid/exportkey", a?.oid === "123" && a?.nid === "456_0_0" && a?.exportKey === "ABC");

  const b = parseWeixinChannelsInput(
    "看看这个 https://channels.weixin.qq.com/finder-preview/pages/sph?id=AzWUzqaDg 不错",
  );
  assert("从文案提取 URL", b?.shareUrl?.includes("sph?id=AzWUzqaDg"));

  const c = parseWeixinChannelsInput("https://www.youtube.com/watch?v=abc");
  assert("非视频号返回 null", c === null);
}

function testCleanUrl() {
  console.log("\n[cleanVideoUrl / buildFullMediaUrl]");
  const raw =
    "https://finder.video.qq.com/251/20302/stodownload?encfilekey=abc123&bizid=1023&token=xyz789&sign=foo";
  const cleaned = cleanVideoUrl(raw);
  assert(
    "保留 encfilekey+token",
    cleaned.includes("encfilekey=abc123") && cleaned.includes("token=xyz789") && !cleaned.includes("bizid="),
  );

  const full = buildFullMediaUrl("https://finder.video.qq.com/x", "&token=abc&sign=def");
  assert("拼接 url_token", full === "https://finder.video.qq.com/x&token=abc&sign=def");
}

function testMapObjectDesc() {
  console.log("\n[mapObjectDescToYtDlp]");
  const sample = {
    nickname: "测试作者",
    object_desc: {
      description: "测试标题",
      media: [
        {
          url: "https://finder.video.qq.com/251/20302/stodownload?encfilekey=k1",
          url_token: "&token=t1",
          decode_key: "2136343393",
          height: 720,
          spec: [{ file_format: "xWT111", height: 720, width: 1280 }],
        },
      ],
    },
  };
  const info = mapObjectDescToYtDlp(sample, "https://channels.weixin.qq.com/x");
  assert("标题与作者", info.title === "测试标题" && info.uploader === "测试作者");
  assert("含 decodeKey", info.formats[0]?._decodeKey === "2136343393");
  assert("多清晰度 URL", info.formats[0]?.url.includes("X-snsvideoflag=xWT111"));
}

function testDecrypt() {
  console.log("\n[decryptWeixinVideo]");
  const buf = Buffer.alloc(256, 0x41);
  const before = buf.slice(0, 16).toString("hex");
  decryptWeixinVideo(buf, "2136343393", 128);
  const after = buf.slice(0, 16).toString("hex");
  assert("解密会修改头部字节", before !== after);
  assert("超出 encLen 部分不变", buf[200] === 0x41);
}

async function testApiIntegration() {
  const testUrl = process.env.WEIXIN_CHANNELS_TEST_URL?.trim();
  if (!testUrl) {
    console.log("\n[API 集成] 跳过（设置 WEIXIN_CHANNELS_TEST_URL 可启用）");
    return;
  }

  console.log(`\n[API 集成] POST ${BASE}/api/video/extract`);
  const res = await fetch(`${BASE}/api/video/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: testUrl }),
    signal: AbortSignal.timeout(120_000),
  });
  const data = await res.json().catch(() => ({}));
  assert("HTTP 200", res.ok, data.error || `HTTP ${res.status}`);
  assert("platform=weixin-channels", data.platform === "weixin-channels", data.platform);
  assert("有 formats", (data.formats?.length || 0) > 0, data.error);
  if (data.title) console.log(`    标题: ${String(data.title).slice(0, 60)}`);
}

async function main() {
  console.log("微信视频号提取测试");
  testParseInput();
  testCleanUrl();
  testMapObjectDesc();
  testDecrypt();
  await testApiIntegration();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
