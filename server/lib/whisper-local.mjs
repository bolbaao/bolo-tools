import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..", "..");
const TRANSCRIBE_SCRIPT = path.join(PROJECT_ROOT, "scripts", "whisper_transcribe.py");

let localAvailableCache = null;

export function getWhisperModel() {
  const raw = env("WHISPER_MODEL") || env("TRANSCRIBE_MODEL") || "base";
  if (raw === "whisper-1") return "base";
  return raw;
}

export function getWhisperLanguage() {
  return env("WHISPER_LANGUAGE") || env("TRANSCRIBE_LANGUAGE") || "auto";
}

export function getWhisperModelPath() {
  const fromEnv = env("WHISPER_MODEL_PATH");
  if (fromEnv) {
    const resolved = path.isAbsolute(fromEnv)
      ? fromEnv
      : path.join(PROJECT_ROOT, fromEnv);
    if (fs.existsSync(path.join(resolved, "model.bin"))) return resolved;
  }
  const model = getWhisperModel();
  const local = path.join(PROJECT_ROOT, ".local", "whisper", model);
  if (fs.existsSync(path.join(local, "model.bin"))) return local;
  return null;
}

export function isLocalWhisperAvailable() {
  if (localAvailableCache !== null) return localAvailableCache;
  if (!fs.existsSync(TRANSCRIBE_SCRIPT)) {
    localAvailableCache = false;
    return false;
  }
  try {
    execSync('python3 -c "import faster_whisper"', {
      stdio: "ignore",
      timeout: 8000,
    });
    localAvailableCache = true;
  } catch {
    localAvailableCache = false;
  }
  return localAvailableCache;
}

/**
 * @param {string} audioPath
 * @param {"srt"|"vtt"|"text"} format
 */
export function transcribeWithLocalWhisper(audioPath, format = "srt") {
  if (!isLocalWhisperAvailable()) {
    throw new Error("LOCAL_WHISPER_MISSING");
  }

  const args = [
    TRANSCRIBE_SCRIPT,
    audioPath,
    "--format",
    format,
    "--model",
    getWhisperModel(),
    "--language",
    getWhisperLanguage(),
  ];

  const modelPath = getWhisperModelPath();
  if (modelPath) {
    args.push("--model-path", modelPath);
  }

  return new Promise((resolve, reject) => {
    const proc = spawn("python3", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      const msg = stderr.trim() || stdout.trim() || `本地转写进程退出码 ${code}`;
      if (/No module named|faster_whisper|LOCAL_WHISPER/i.test(msg)) {
        reject(new Error("LOCAL_WHISPER_MISSING"));
        return;
      }
      reject(new Error(msg.slice(-800)));
    });
    proc.on("error", (e) => {
      if (e.code === "ENOENT") {
        reject(new Error("未找到 python3，请先安装 Python 3"));
      } else {
        reject(e);
      }
    });
  });
}
