import { execFile, execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..", "..");
const TTS_SCRIPT = path.join(PROJECT_ROOT, "scripts", "edge_tts_speak.py");

export const DEFAULT_TTS_VOICES = [
  { id: "zh-CN-XiaoxiaoNeural", label: "晓晓（女声）" },
  { id: "zh-CN-YunxiNeural", label: "云希（男声）" },
  { id: "zh-CN-YunyangNeural", label: "云扬（新闻男声）" },
  { id: "zh-CN-XiaoyiNeural", label: "晓伊（女声）" },
];

function resolvePythonBin() {
  const fromEnv = env("PYTHON_BIN") || env("PYTHON");
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  return "python3";
}

function pythonChildEnv() {
  const extra = env("PYTHONPATH");
  const paths = [
    extra,
    `${process.env.HOME}/Library/Python/3.9/lib/python/site-packages`,
    `${process.env.HOME}/Library/Python/3.10/lib/python/site-packages`,
    `${process.env.HOME}/Library/Python/3.11/lib/python/site-packages`,
    `${process.env.HOME}/Library/Python/3.12/lib/python/site-packages`,
    `${process.env.HOME}/Library/Python/3.13/lib/python/site-packages`,
  ].filter(Boolean);
  return { ...process.env, PYTHONPATH: paths.join(path.delimiter) };
}

export function isEdgeTtsAvailable() {
  if (!fs.existsSync(TTS_SCRIPT)) return false;
  try {
    execFileSync(
      resolvePythonBin(),
      ["-c", "import edge_tts"],
      { stdio: "ignore", timeout: 10_000, env: pythonChildEnv() },
    );
    return true;
  } catch {
    return false;
  }
}

export function getEdgeTtsHint() {
  if (!fs.existsSync(TTS_SCRIPT)) return "缺少 scripts/edge_tts_speak.py";
  if (!isEdgeTtsAvailable()) {
    return "请运行: python3 -m pip install --user edge-tts（或 ./scripts/install-deps.sh）后重启服务";
  }
  return null;
}

export function getDefaultTtsVoice() {
  return env("VOICEOVER_TTS_VOICE") || "zh-CN-XiaoxiaoNeural";
}

/**
 * @param {{ text: string, outputPath: string, voice?: string, rate?: string }} opts
 */
export function synthesizeSpeech(opts) {
  const { text, outputPath, voice = getDefaultTtsVoice(), rate = env("VOICEOVER_TTS_RATE") || "+0%" } =
    opts;

  return new Promise((resolve, reject) => {
    if (!isEdgeTtsAvailable()) {
      reject(new Error("EDGE_TTS_MISSING"));
      return;
    }
    const pythonBin = resolvePythonBin();
    execFile(
      pythonBin,
      [TTS_SCRIPT, "--text", text, "--voice", voice, "--output", outputPath, "--rate", rate],
      { env: pythonChildEnv(), maxBuffer: 4 * 1024 * 1024, timeout: 120_000 },
      (err, _stdout, stderr) => {
        if (err) {
          reject(new Error(stderr?.slice(-500) || err.message || "语音合成失败"));
          return;
        }
        if (!fs.existsSync(outputPath)) {
          reject(new Error("语音合成未生成输出文件"));
          return;
        }
        resolve(outputPath);
      },
    );
  });
}
