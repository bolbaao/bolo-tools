#!/usr/bin/env node
import assert from "node:assert/strict";
import { pickChatProviderForRequest } from "../server/lib/chat-provider-routing.mjs";

const cases = [
  {
    name: "闲聊默认 DeepSeek",
    opts: { messages: [{ role: "user", content: "你好呀" }] },
    expect: "deepseek",
  },
  {
    name: "带链接任务走 DeepSeek",
    opts: { messages: [{ role: "user", content: "帮我下载 https://v.douyin.com/xxx" }] },
    expect: "deepseek",
  },
  {
    name: "附图走火山方舟",
    opts: {
      messages: [{ role: "user", content: "看看这张图\n[用户发送了 1 张图片]" }],
      pageContext: { chatImages: [{ previewDataUrl: "data:image/png;base64,abc" }] },
    },
    expect: "ark",
  },
  {
    name: "Agent 模式任务走 DeepSeek",
    opts: { mode: "agent", messages: [{ role: "user", content: "帮我搜一部电影" }] },
    expect: "deepseek",
  },
];

let failed = 0;
for (const c of cases) {
  const got = pickChatProviderForRequest(c.opts);
  if (got !== c.expect) {
    failed++;
    console.error(`❌ ${c.name}: expected ${c.expect}, got ${got}`);
  } else {
    console.log(`✅ ${c.name}`);
  }
}

if (failed) process.exit(1);
console.log("\n路由用例通过（需同时配置 DEEPSEEK 与 ARK 时才会在运行时切换）");
