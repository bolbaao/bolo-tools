import { execFileSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..", "..");
const BUNDLE_ROOT = path.join(PROJECT_ROOT, ".local", "mlsharp-3d-maker");
const MANIFEST_PATH = path.join(BUNDLE_ROOT, "manifest.json");
const MAC_VENV_SHARP = path.join(PROJECT_ROOT, ".local", "mlsharp-venv", "bin", "sharp");

const DEFAULT_TIMEOUT_MS = Number(env("MLSHARP3D_TIMEOUT_MS") || 600_000);
const PREPROCESS_SCRIPT = path.join(PROJECT_ROOT, "scripts", "mlsharp-preprocess.py");
const VENV_PYTHON = path.join(PROJECT_ROOT, ".local", "mlsharp-venv", "bin", "python3");

/** @type {Record<string, { internalSize: number; label: string }>} */
export const MLSHARP_QUALITY_PRESETS = {
  standard: { internalSize: 1536, label: "标准" },
  high: { internalSize: 2048, label: "高清" },
  ultra: { internalSize: 2048, label: "超清" },
};

export function resolveQuality(raw) {
  const key = String(raw || "standard").toLowerCase();
  return MLSHARP_QUALITY_PRESETS[key] ? key : "standard";
}

function isRunnableSharp(bin) {
  if (!bin || !fs.existsSync(bin)) return false;
  if (process.platform !== "win32" && bin.toLowerCase().endsWith(".exe")) return false;
  try {
    fs.accessSync(bin, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function loadManifest() {
  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
      if (data?.sharpBin && isRunnableSharp(data.sharpBin)) return data;
      if (data?.runtime === "pending-mac-venv" && isRunnableSharp(MAC_VENV_SHARP)) {
        return {
          ...data,
          runtime: "mac-venv",
          sharpBin: MAC_VENV_SHARP,
        };
      }
    } catch {
      /* ignore */
    }
  }

  if (isRunnableSharp(MAC_VENV_SHARP)) {
    const checkpoint = findBundledCheckpoint();
    return {
      version: 2,
      runtime: "mac-venv",
      sharpBin: MAC_VENV_SHARP,
      checkpoint,
      cwd: PROJECT_ROOT,
      root: findBundleRoot(),
      source: "apple/ml-sharp + GemosDodo checkpoint",
    };
  }

  return null;
}

function findBundleRoot() {
  const nested = path.join(BUNDLE_ROOT, "MLSharp-3D-Maker-by-GemosDodo");
  if (fs.existsSync(nested)) return nested;
  return fs.existsSync(BUNDLE_ROOT) ? BUNDLE_ROOT : null;
}

function findBundledCheckpoint() {
  const root = findBundleRoot();
  if (!root) return null;
  const preferred = path.join(root, "model_assets", "sharp_2572gikvuh.pt");
  return fs.existsSync(preferred) ? preferred : null;
}

export function isMlsharpAvailable() {
  return Boolean(loadManifest()?.sharpBin);
}

function childEnv(manifest, quality = "standard") {
  const child = { ...process.env };
  const hf = env("HF_ENDPOINT") || process.env.HF_ENDPOINT;
  if (hf) child.HF_ENDPOINT = hf;

  // start.sh 会把用户 site-packages 写入 PYTHONPATH，污染 3.11 venv 导致 numpy 冲突
  delete child.PYTHONPATH;
  delete child.PYTHONHOME;

  const preset = MLSHARP_QUALITY_PRESETS[resolveQuality(quality)];
  child.MLSHARP3D_INTERNAL_SIZE = String(preset.internalSize);

  const venvRoot = path.join(PROJECT_ROOT, ".local", "mlsharp-venv");
  const venvBin = path.join(venvRoot, "bin");
  if (fs.existsSync(venvBin)) {
    child.PATH = `${venvBin}${path.delimiter}${child.PATH || ""}`;
    child.VIRTUAL_ENV = venvRoot;
  }

  const binDir = manifest?.cwd || (manifest?.sharpBin ? path.dirname(manifest.sharpBin) : null);
  if (binDir && binDir !== venvBin) {
    child.PATH = `${binDir}${path.delimiter}${child.PATH || ""}`;
  }

  return child;
}

function runPreprocess({ inputPath, outputPath, quality, manifest }) {
  if (!fs.existsSync(PREPROCESS_SCRIPT) || !fs.existsSync(VENV_PYTHON)) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const proc = spawn(
      VENV_PYTHON,
      [PREPROCESS_SCRIPT, inputPath, outputPath, "--quality", resolveQuality(quality)],
      { env: childEnv(manifest, quality) },
    );
    let stderr = "";
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0 && fs.existsSync(outputPath)) resolve();
      else reject(new Error(stderr.trim().slice(-400) || "图像预处理失败"));
    });
  });
}

export function canRenderVideo() {
  if (process.platform === "darwin" && process.arch === "arm64") return true;
  if (process.platform === "linux" || process.platform === "win32") {
    return Boolean(env("MLSHARP3D_FORCE_RENDER") === "1" || env("CUDA_VISIBLE_DEVICES"));
  }
  return env("MLSHARP3D_FORCE_RENDER") === "1";
}

export function getMlsharpStatus() {
  const manifest = loadManifest();
  const checkpoint = manifest?.checkpoint || findBundledCheckpoint();
  const bundleReady = Boolean(checkpoint);
  const runtimeReady = Boolean(manifest?.sharpBin);
  const available = runtimeReady;
  const renderSupported = available && canRenderVideo();

  let hint = null;
  if (!bundleReady) {
    hint = "3D 生成功能尚未就绪，请稍后再试";
  } else if (!runtimeReady) {
    hint = "3D 生成功能正在初始化，请稍后再试";
  } else if (!renderSupported) {
    hint = "当前环境可生成 .ply 模型；预览视频需 Apple Silicon 或 NVIDIA GPU";
  }

  return {
    available,
    installed: bundleReady,
    runtimeReady,
    source: manifest?.source ?? null,
    root: manifest?.root ?? findBundleRoot(),
    runtime: manifest?.runtime ?? null,
    renderSupported,
    hint,
  };
}

function collectFiles(dir, ext) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const walk = (current) => {
    for (const name of fs.readdirSync(current)) {
      const full = path.join(current, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (name.toLowerCase().endsWith(ext)) out.push(full);
    }
  };
  walk(dir);
  return out;
}

export function runSharpPredict({
  inputPath,
  outputDir,
  render = false,
  quality = "standard",
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const manifest = loadManifest();
  if (!manifest?.sharpBin) {
    const checkpoint = findBundledCheckpoint();
    if (checkpoint) {
      return Promise.reject(
        new Error("模型已就绪，请先运行 ./scripts/install-mlsharp-mac.sh 安装 ML-Sharp 运行时"),
      );
    }
    return Promise.reject(new Error("MLSharp 3D Maker 未安装，请运行 ./scripts/download-mlsharp-3d-maker.sh"));
  }

  const q = resolveQuality(quality);

  return (async () => {
    const inputDir = fs.statSync(inputPath).isDirectory() ? inputPath : path.dirname(inputPath);
    const inputFile = fs.statSync(inputPath).isDirectory()
      ? fs.readdirSync(inputPath).find((n) => /\.(jpe?g|png|webp|heic)$/i.test(n))
      : path.basename(inputPath);
    if (!inputFile) throw new Error("未找到输入图片");

    const srcFile = fs.statSync(inputPath).isDirectory()
      ? path.join(inputDir, inputFile)
      : inputPath;
    const preprocessed = path.join(inputDir, `_pre_${path.basename(srcFile, path.extname(srcFile))}.jpg`);

    try {
      await runPreprocess({ inputPath: srcFile, outputPath: preprocessed, quality: q, manifest });
      if (fs.existsSync(preprocessed)) {
        fs.copyFileSync(preprocessed, srcFile);
      }
    } catch (err) {
      if (q !== "standard") throw err;
    }

    fs.mkdirSync(outputDir, { recursive: true });

    const args = ["predict", "-i", inputDir, "-o", outputDir];
    const checkpoint = manifest.checkpoint || findBundledCheckpoint();
    if (checkpoint && fs.existsSync(checkpoint)) {
      args.push("-c", checkpoint);
    }
    if (render) {
      if (!canRenderVideo()) {
        throw new Error("当前环境不支持渲染预览视频，请取消勾选或换用 Apple Silicon / NVIDIA GPU");
      }
      args.push("--render");
    }

    return await new Promise((resolve, reject) => {
      const proc = spawn(manifest.sharpBin, args, {
        cwd: manifest.cwd || path.dirname(manifest.sharpBin),
        env: childEnv(manifest, q),
      });

      let stderr = "";
      let stdout = "";
      const timer = setTimeout(() => {
        proc.kill("SIGTERM");
        reject(new Error("3D 生成超时，请稍后重试"));
      }, timeoutMs);

      proc.stdout.on("data", (d) => {
        stdout += d.toString();
      });
      proc.stderr.on("data", (d) => {
        stderr += d.toString();
      });
      proc.on("error", (err) => {
        clearTimeout(timer);
        reject(err.code === "ENOENT" ? new Error("未找到 sharp 可执行文件，请运行 ./scripts/install-mlsharp-mac.sh") : err);
      });
      proc.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          const tail = (stderr || stdout).trim().slice(-800);
          reject(new Error(tail || `sharp 退出码 ${code}`));
          return;
        }

        const plyFiles = collectFiles(outputDir, ".ply");
        const videoFiles = collectFiles(outputDir, ".mp4");
        if (!plyFiles.length) {
          reject(new Error("生成完成但未找到 .ply 文件，请检查安装是否完整"));
          return;
        }

        resolve({
          plyPath: plyFiles[0],
          plyFiles,
          videoFiles,
          quality: q,
          stdout,
          stderr,
        });
      });
    });
  })();
}

/** 供安装脚本检测 sharp 是否可用 */
export function probeSharpCli() {
  const manifest = loadManifest();
  if (!manifest?.sharpBin) return false;
  try {
    execFileSync(manifest.sharpBin, ["--help"], {
      env: childEnv(manifest),
      stdio: "ignore",
      timeout: 15_000,
    });
    return true;
  } catch {
    return false;
  }
}
