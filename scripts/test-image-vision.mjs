#!/usr/bin/env node
/**
 * 图片识别（AI 对话）功能测试
 * 用法: node scripts/test-image-vision.mjs [baseUrl]
 */
import "dotenv/config";
import {
  activeVisionProviderLabel,
  chatImageVisionPayload,
  describePhotoDataUrl,
  photoVisionConfigured,
  resolveChatImagesSnapshot,
} from "../server/lib/photo-vision.mjs";

const BASE = process.argv[2] || "http://127.0.0.1:3000";
const TIMEOUT_MS = 90_000;

let testDataUrlPromise;

/** 方舟要求图片边长 ≥14px，测试用 128×128 红块 */
async function getTestDataUrl() {
  if (!testDataUrlPromise) {
    testDataUrlPromise = (async () => {
      const { createCanvas } = await import("canvas").catch(() => ({}));
      if (createCanvas) {
        const c = createCanvas(128, 128);
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#cc2222";
        ctx.fillRect(0, 0, 128, 128);
        return c.toDataURL("image/jpeg", 0.85);
      }
      const res = await fetch("https://picsum.photos/128/128.jpg");
      const buf = Buffer.from(await res.arrayBuffer());
      return `data:image/jpeg;base64,${buf.toString("base64")}`;
    })();
  }
  return testDataUrlPromise;
}

function ok(label, detail = "") {
  console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label, detail = "") {
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  process.exitCode = 1;
}

function skip(label, reason) {
  console.log(`  ○ ${label} — 跳过: ${reason}`);
}

async function testModuleLayer() {
  console.log("\n[1] 模块层（photo-vision.mjs）");

  if (!photoVisionConfigured()) {
    skip("describePhotoDataUrl", "未配置 ARK_VISION_API_KEY 或 ARK_API_KEY");
    return { configured: false };
  }

  const label = activeVisionProviderLabel();
  ok("视觉 API 已配置", label ?? "火山方舟");

  const t0 = Date.now();
  let result;
  try {
    const testUrl = await getTestDataUrl();
    result = await describePhotoDataUrl(testUrl, "图里有什么颜色？");
  } catch (e) {
    const msg = e.message || String(e);
    if (/credit|spending limit|余额|额度|HTTP 403|API key format/i.test(msg)) {
      skip("describePhotoDataUrl", `方舟不可用: ${msg.slice(0, 120)}`);
    } else {
      fail("describePhotoDataUrl", msg);
    }
    return { configured: true };
  }
  const ms = Date.now() - t0;

  if (!result?.description) {
    fail("describePhotoDataUrl", "无描述返回");
    return { configured: true, liveVision: true };
  }
  ok("describePhotoDataUrl", `${result.providerLabel} · ${ms}ms · ${result.description.slice(0, 80)}…`);

  return { configured: true, ms, liveVision: true };
}

async function testCacheOnly() {
  console.log("\n[1b] 缓存逻辑（无需调用视觉 API）");
  const cached = await resolveChatImagesSnapshot(
    [
      {
        name: "cached.jpg",
        size: 100,
        lastModified: 1,
        mimeType: "image/jpeg",
        visionDescription: "（缓存）红色测试图",
        visionProvider: "test",
      },
    ],
    { userContext: "测试" },
  );
  const item = cached?.items?.[0];
  if (item?.description === "（缓存）红色测试图" && !item.error) {
    ok("识别缓存", "含 visionDescription 时跳过 API");
  } else {
    fail("识别缓存", JSON.stringify(item));
  }
  const payload = chatImageVisionPayload(cached);
  if (payload[0]?.description) ok("chatImageVisionPayload");
  else fail("chatImageVisionPayload");
}

async function testChatApiCachedOnly() {
  console.log("\n[2a] HTTP · 仅缓存识别结果（不调视觉 API）");
  let health;
  try {
    const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(5000) });
    health = r.ok;
  } catch {
    return;
  }
  if (!health) return;

  const body = {
    messages: [{ role: "user", content: "图里写的什么？" }],
    pageContext: {
      path: "/tools/ai-chat",
      chatImages: [
        {
          name: "memo.jpg",
          size: 500,
          lastModified: 42,
          mimeType: "image/jpeg",
          width: 100,
          height: 100,
          visionDescription: "一张便签，上面写着「测试通过」",
          visionProvider: "cache-test",
        },
      ],
    },
  };
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    fail("缓存上下文 /api/chat", data.error || `HTTP ${res.status}`);
    return;
  }
  const snap = data.chatImageVision?.[0];
  if (snap?.description?.includes("测试通过")) {
    ok("缓存上下文 /api/chat", `reply 含识别: ${String(data.reply).slice(0, 80)}…`);
  } else {
    fail("缓存上下文", snap?.error || "未带回缓存描述");
  }
}

async function testChatApi() {
  console.log("\n[2b] HTTP · POST /api/chat（实时视觉识别）");

  let health;
  try {
    const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(5000) });
    health = r.ok;
  } catch {
    skip("/api/chat", `服务未启动，请先运行 ./start.sh 或访问 ${BASE}`);
    return;
  }
  if (!health) {
    skip("/api/chat", `${BASE}/api/health 不可用`);
    return;
  }
  ok("API 健康检查");

  await testChatApiCachedOnly();

  if (!photoVisionConfigured()) {
    skip("/api/chat 含图（实时识别）", "无视觉 Key");
    return;
  }

  const body = {
    messages: [{ role: "user", content: "请根据图片告诉我主要颜色。" }],
    pageContext: {
      path: "/tools/ai-chat",
      chatImages: [
        {
          name: "test.jpg",
          size: 1200,
          lastModified: Date.now(),
          mimeType: "image/jpeg",
          width: 64,
          height: 64,
          previewDataUrl: await getTestDataUrl(),
        },
      ],
    },
  };

  const t0 = Date.now();
  let res;
  let data;
  try {
    res = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    data = await res.json().catch(() => ({}));
  } catch (e) {
    fail("/api/chat", e.message);
    return;
  }
  const ms = Date.now() - t0;

  if (!res.ok) {
    const err = data.error || `HTTP ${res.status}`;
    if (/credit|spending limit|额度|API key format/i.test(String(err))) {
      skip("/api/chat 含图", `方舟 API 不可用`);
      return;
    }
    fail("/api/chat", err);
    return;
  }

  if (!data.ok || !data.reply) {
    fail("/api/chat", "无 reply");
    return;
  }

  const vision = data.chatImageVision?.[0];
  if (!vision?.description) {
    const err = vision?.error || "无 description";
    if (/credit|spending limit|HTTP 403|Model not found/i.test(String(err))) {
      skip("chatImageVision（实时）", err.slice(0, 100));
      return;
    }
    fail("chatImageVision", err);
  } else {
    ok("chatImageVision", vision.visionProvider || "—");
  }

  ok("/api/chat", `${ms}ms · reply: ${String(data.reply).slice(0, 100)}…`);

  const bodyCached = {
    messages: [
      { role: "user", content: "请根据图片告诉我主要颜色。" },
      { role: "assistant", content: "好的。" },
      { role: "user", content: "再确认一次颜色。" },
    ],
    pageContext: {
      path: "/tools/ai-chat",
      chatImages: [
        {
          name: "test.jpg",
          size: 1200,
          lastModified: body.pageContext.chatImages[0].lastModified,
          mimeType: "image/jpeg",
          width: 64,
          height: 64,
          visionDescription: vision.description,
          visionProvider: vision.visionProvider,
        },
      ],
    },
  };

  const t1 = Date.now();
  const res2 = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyCached),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data2 = await res2.json().catch(() => ({}));
  const ms2 = Date.now() - t1;

  if (!res2.ok || !data2.ok) {
    fail("缓存后第二次 /api/chat", data2.error || `HTTP ${res2.status}`);
    return;
  }
  if (data2.chatImageVision?.[0]?.description === vision.description) {
    ok("缓存后第二次请求", `${ms2}ms（应明显快于首次 ${ms}ms）`);
  } else {
    fail("缓存后第二次请求", "vision 结果不一致");
  }
}

async function main() {
  console.log("🍍 图片识别功能测试");
  console.log(`   BASE=${BASE}`);

  await testCacheOnly();
  const mod = await testModuleLayer();
  if (!mod?.liveVision) {
    console.log("\n  提示: 实时识别需有效 ARK_VISION_API_KEY（或 ARK_API_KEY）与 ARK_VISION_MODEL；缓存与 /api/chat 结构仍可验证。");
  }
  await testChatApi();

  console.log(process.exitCode ? "\n部分测试未通过。" : "\n全部通过。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
