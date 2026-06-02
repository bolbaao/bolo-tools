#!/usr/bin/env node
/**
 * Suno 网关连通性测试（需已配置 .env 并重启服务）
 * node scripts/test-suno-live.mjs
 */
import "../server/lib/env.mjs";
import { resolveSunoConfig } from "../server/lib/suno-config.mjs";
import { generateAiMusic } from "../server/lib/ai-music.mjs";

async function main() {
  const cfg = resolveSunoConfig();
  if (!cfg.configured) {
    console.error("❌ 未配置 Suno。请先运行: node scripts/setup-suno.mjs");
    process.exit(1);
  }

  console.log(`\n🎵 测试 Suno 网关: ${cfg.providerLabel || cfg.providerId} → ${cfg.baseURL}`);
  console.log("   提交短灵感任务（约 1–3 分钟）…\n");

  const tracks = await generateAiMusic({
    prompt: "一首 10 秒左右的轻快测试曲，关于菠萝",
    style: "pop, chinese",
    mode: "inspiration",
    instrumental: true,
  });

  const t = tracks[0];
  if (!t) {
    console.error("❌ 未返回曲目");
    process.exit(1);
  }

  const hasAudio = Boolean(t.audioUrl || t.audioBase64);
  if (!hasAudio) {
    console.error("❌ 曲目无音频");
    process.exit(1);
  }

  console.log(`✅ 成曲成功: ${t.title}`);
  console.log(`   ${t.demo ? "演示模式" : "Suno 完整模式"}`);
  if (t.audioUrl) console.log(`   音频: ${t.audioUrl.slice(0, 80)}…`);
  else console.log(`   音频: base64 (${t.audioBase64?.length || 0} 字符)`);
  console.log("");
}

main().catch((e) => {
  console.error("❌", e.message || e);
  process.exit(1);
});
