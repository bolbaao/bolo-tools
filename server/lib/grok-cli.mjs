import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { env } from "./env.mjs";

const CHAT_SYSTEM =
  "你是轻松友好的闲聊伙伴。用口语化中文回复，简短自然，像朋友聊天。不要扮演专家或顾问，不要列长清单。不要执行工具或读写文件，只回复文字。";

export function resolveGrokBin() {
  const fromEnv = env("GROK_BIN");
  if (fromEnv) return fromEnv;
  const homeBin = path.join(os.homedir(), ".grok", "bin", "grok");
  if (fs.existsSync(homeBin)) return homeBin;
  return "grok";
}

export function hasGrokCliAuth() {
  if (env("XAI_API_KEY") || env("GROK_API_KEY") || env("GROK_DEPLOYMENT_KEY")) {
    return true;
  }
  const authFile = path.join(os.homedir(), ".grok", "auth.json");
  return fs.existsSync(authFile);
}

export function isGrokCliReady() {
  const bin = resolveGrokBin();
  if (bin !== "grok" && !fs.existsSync(bin)) return false;
  return hasGrokCliAuth();
}

function grokEnv() {
  return {
    ...process.env,
    HOME: process.env.HOME || os.homedir(),
    PATH: `${path.join(os.homedir(), ".grok", "bin")}:${process.env.PATH || ""}`,
  };
}

export function buildChatPrompt(messages) {
  const history = messages
    .map((m) => {
      const role = m.role === "user" ? "用户" : "助手";
      return `${role}：${String(m.content ?? "").trim()}`;
    })
    .filter((line) => line.length > 3)
    .join("\n");

  return `${CHAT_SYSTEM}\n\n对话记录：\n${history}\n\n请回复用户的最后一条消息。`;
}

function extractTextFromJson(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value.text === "string") return value.text.trim();
  if (typeof value.content === "string") return value.content.trim();
  if (typeof value.output === "string") return value.output.trim();
  if (typeof value.message === "string") return value.message.trim();
  if (value.result) return extractTextFromJson(value.result);
  if (Array.isArray(value.messages)) {
    const last = [...value.messages].reverse().find((m) => m.role === "assistant");
    if (last?.content) return extractTextFromJson(last.content);
  }
  return "";
}

function parseGrokOutput(stdout) {
  const raw = stdout.trim();
  if (!raw) return "";

  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      const fromJson = extractTextFromJson(parsed);
      if (fromJson) return fromJson;
    } catch {
      // fall through to plain text
    }
  }

  return raw;
}

export function runGrokCli({ prompt, sessionId, model }) {
  const bin = resolveGrokBin();
  const args = [
    "--no-auto-update",
    "--no-alt-screen",
    "--always-approve",
    "--permission-mode",
    "dontAsk",
    "--output-format",
    env("GROK_CLI_OUTPUT", "plain"),
    "-p",
    prompt,
  ];

  if (sessionId) args.push("-s", sessionId);
  if (model) args.push("-m", model);

  const cwd = env("GROK_CLI_CWD") || os.tmpdir();
  const timeoutMs = Number(env("GROK_CLI_TIMEOUT_MS", "120000")) || 120000;

  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, {
      env: grokEnv(),
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error("Grok CLI 响应超时，请稍后重试"));
    }, timeoutMs);

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      if (err.code === "ENOENT") {
        reject(
          new Error(
            "未找到 grok 命令。请运行：curl -fsSL https://x.ai/cli/install.sh | bash",
          ),
        );
        return;
      }
      reject(err);
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const detail = (stderr || stdout).trim().slice(0, 400);
        if (/not authenticated|login|auth/i.test(detail)) {
          reject(new Error("Grok 未登录。请在终端运行：grok login"));
          return;
        }
        reject(new Error(detail || `Grok CLI 退出码 ${code}`));
        return;
      }

      const reply = parseGrokOutput(stdout);
      if (!reply) {
        reject(new Error("Grok CLI 未返回有效内容"));
        return;
      }
      resolve(reply);
    });
  });
}
