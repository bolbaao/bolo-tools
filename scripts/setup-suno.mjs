#!/usr/bin/env node
/**
 * 配置 Suno API 网关到 .env
 *
 * 交互：node scripts/setup-suno.mjs
 * 命令行：node scripts/setup-suno.mjs --provider gptnb --key sk-xxx
 * 验证：  node scripts/setup-suno.mjs --check
 */
import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";
import { SUNO_PRESETS } from "../server/lib/suno-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");

function parseArgs(argv) {
  const out = { check: false, provider: "", key: "", base: "" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--check") out.check = true;
    else if (a === "--provider" && argv[i + 1]) out.provider = argv[++i];
    else if (a === "--key" && argv[i + 1]) out.key = argv[++i];
    else if (a === "--base" && argv[i + 1]) out.base = argv[++i];
  }
  return out;
}

function upsertEnvLines(content, entries) {
  const lines = content.split("\n");
  const keys = new Set(Object.keys(entries));

  const next = lines.map((line) => {
    const m = line.match(/^([A-Z0-9_]+)=/);
    if (m && keys.has(m[1])) {
      const val = entries[m[1]];
      keys.delete(m[1]);
      return `${m[1]}=${val}`;
    }
    return line;
  });

  if (keys.size) {
    if (next.length && next[next.length - 1] !== "") next.push("");
    next.push("# AI 文字成曲 · Suno 网关");
    for (const key of keys) {
      next.push(`${key}=${entries[key]}`);
    }
  }

  return next.join("\n");
}

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question(question, resolve));
  rl.close();
  return answer.trim();
}

async function collectConfig(args) {
  if (args.provider && args.key) {
    return {
      provider: args.provider,
      key: args.key,
      base: args.base,
    };
  }

  console.log("\n🎵 Suno 网关配置\n");
  console.log("可选提供商：");
  for (const [id, p] of Object.entries(SUNO_PRESETS)) {
    console.log(`  ${id.padEnd(12)} ${p.label.padEnd(12)} ${p.baseUrl}`);
  }
  console.log("  custom       自定义 Base URL\n");

  const provider =
    args.provider ||
    (await prompt("提供商 [gptnb / openai-hk / custom] (默认 gptnb): ")) ||
    "gptnb";

  const preset = SUNO_PRESETS[provider];
  let base = args.base;
  if (!base && provider === "custom") {
    base = await prompt("SUNO_API_BASE (如 https://api.example.com): ");
  }

  const key = args.key || (await prompt("SUNO_API_KEY: "));
  if (!key) throw new Error("未填写 SUNO_API_KEY");

  return { provider, key, base: base || preset?.baseUrl || "" };
}

async function checkConfig() {
  await import("../server/lib/env.mjs");
  const { resolveSunoConfig } = await import("../server/lib/suno-config.mjs");
  const { aiMusicCapabilities } = await import("../server/lib/ai-music.mjs");

  const cfg = resolveSunoConfig();
  const caps = aiMusicCapabilities();

  console.log("\n当前 Suno 配置：");
  console.log(`  provider : ${cfg.providerId || "(未设)"} ${cfg.providerLabel ? `(${cfg.providerLabel})` : ""}`);
  console.log(`  base     : ${cfg.baseURL || "(未设)"}`);
  console.log(`  key      : ${cfg.apiKey ? `${cfg.apiKey.slice(0, 8)}…` : "(未设)"}`);
  console.log(`  model    : ${cfg.model}`);
  console.log(`  api mode : ${cfg.apiMode}`);
  console.log(`  suno     : ${caps.suno ? "已就绪" : "未就绪"}`);
  console.log(`  demo     : ${caps.demo ? "可用" : "不可用"}`);
  console.log(`  运行模式 : ${caps.mode}\n`);

  if (!cfg.configured) {
    console.log("❌ 尚未配置完整。运行: node scripts/setup-suno.mjs\n");
    process.exitCode = 1;
    return;
  }

  const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
  try {
    const res = await fetch(`${base}/api/ai-music/capabilities`);
    const data = await res.json();
    console.log("✅ 服务 capabilities:", JSON.stringify(data));
  } catch {
    console.log("⚠️  本地服务未启动，跳过 HTTP 检查。请先 ./start.sh");
  }
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.check) {
    await checkConfig();
    return;
  }

  const { provider, key, base } = await collectConfig(args);
  const preset = SUNO_PRESETS[provider];

  const entries = {
    SUNO_PROVIDER: provider === "custom" ? "" : provider,
    SUNO_API_BASE: base || preset?.baseUrl || "",
    SUNO_API_KEY: key,
    SUNO_MODEL: preset?.model || "chirp-v4",
    SUNO_API_MODE: preset?.apiMode || "auto",
    SUNO_TIMEOUT_MS: "300000",
  };

  if (!entries.SUNO_API_BASE) throw new Error("缺少 SUNO_API_BASE");

  let content = "";
  if (fs.existsSync(ENV_PATH)) content = fs.readFileSync(ENV_PATH, "utf8");
  else content = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");

  fs.writeFileSync(ENV_PATH, upsertEnvLines(content, entries));

  console.log("\n✅ 已写入 .env");
  console.log(`   SUNO_API_BASE=${entries.SUNO_API_BASE}`);
  console.log(`   SUNO_API_MODE=${entries.SUNO_API_MODE}`);
  console.log(`   SUNO_MODEL=${entries.SUNO_MODEL}`);
  if (preset?.docs) console.log(`   文档: ${preset.docs}`);
  console.log("\n请重启服务: ./start.sh");
  console.log("验证配置: node scripts/setup-suno.mjs --check\n");
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
