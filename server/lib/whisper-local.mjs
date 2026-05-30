import { execFileSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..", "..");
const TRANSCRIBE_SCRIPT = path.join(PROJECT_ROOT, "scripts", "whisper_transcribe.py");

export function getWhisperModel() {
  const raw = env("WHISPER_MODEL") || env("TRANSCRIBE_MODEL") || "base";
  if (raw === "whisper-1") return "base";
  return raw;
}

export function getWhisperLanguage() {
  return env("WHISPER_LANGUAGE") || env("TRANSCRIBE_LANGUAGE") || "zh";
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

function resolvePythonBin() {
  const fromEnv = env("PYTHON_BIN") || env("PYTHON");
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  return "python3";
}

function pythonHasFasterWhisper(pythonBin) {
  try {
    execFileSync(
      pythonBin,
      ["-c", "import faster_whisper"],
      { stdio: "ignore", timeout: 10_000, env: whisperChildEnv() },
    );
    return true;
  } catch {
    return false;
  }
}

function whisperChildEnv() {
  const extra = env("PYTHONPATH");
  const paths = [
    extra,
    `${process.env.HOME}/Library/Python/3.9/lib/python/site-packages`,
    `${process.env.HOME}/Library/Python/3.10/lib/python/site-packages`,
    `${process.env.HOME}/Library/Python/3.11/lib/python/site-packages`,
    `${process.env.HOME}/Library/Python/3.12/lib/python/site-packages`,
    `${process.env.HOME}/Library/Python/3.13/lib/python/site-packages`,
  ].filter(Boolean);
  const child = {
    ...process.env,
    PYTHONPATH: paths.join(path.delimiter),
  };
  const hf = env("HF_ENDPOINT") || process.env.HF_ENDPOINT;
  if (hf) child.HF_ENDPOINT = hf;
  return child;
}

export function isLocalWhisperAvailable() {
  if (!fs.existsSync(TRANSCRIBE_SCRIPT)) return false;
  return pythonHasFasterWhisper(resolvePythonBin());
}

export function getLocalWhisperHint() {
  if (!fs.existsSync(TRANSCRIBE_SCRIPT)) {
    return "缺少转写脚本 scripts/whisper_transcribe.py";
  }
  if (!pythonHasFasterWhisper(resolvePythonBin())) {
    return "请运行: python3 -m pip install --user faster-whisper（或 ./scripts/install-deps.sh）后重启 ./start.sh";
  }
  if (!getWhisperModelPath()) {
    return "本地模型未就绪。请运行: ./scripts/download-whisper-model.sh（约 150MB）";
  }
  return null;
}

/**
 * @param {string} audioPath
 * @param {"srt"|"vtt"|"text"} format
 */
export function transcribeWithLocalWhisper(audioPath, format = "srt") {
  if (!isLocalWhisperAvailable()) {
    throw new Error("LOCAL_WHISPER_MISSING");
  }

  const pythonBin = resolvePythonBin();
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
    const proc = spawn(pythonBin, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: whisperChildEnv(),
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
      if (/Hub|huggingface|Connection|SSL|timed out|下载/i.test(msg)) {
        reject(
          new Error(
            "无法下载 Whisper 模型。请运行 ./scripts/download-whisper-model.sh 预下载到 .local/whisper/base 后重试",
          ),
        );
        return;
      }
      reject(new Error(msg.slice(-800)));
    });
    proc.on("error", (e) => {
      if (e.code === "ENOENT") {
        reject(new Error("未找到 python3。请安装 Python 3 或在 .env 设置 PYTHON_BIN"));
      } else {
        reject(e);
      }
    });
  });
}
