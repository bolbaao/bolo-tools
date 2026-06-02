#!/usr/bin/env node
/**
 * 写入 .local/mlsharp-3d-maker/manifest.json
 * - Windows：使用 GemosDodo 整合包内的 sharp.exe
 * - macOS / Linux：使用 .local/mlsharp-venv/bin/sharp + 整合包内模型权重
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..");
const BUNDLE_ROOT = path.join(PROJECT_ROOT, ".local", "mlsharp-3d-maker");
const MANIFEST_PATH = path.join(BUNDLE_ROOT, "manifest.json");
const MAC_VENV_SHARP = path.join(PROJECT_ROOT, ".local", "mlsharp-venv", "bin", "sharp");
const MAC_VENV_PYTHON = path.join(PROJECT_ROOT, ".local", "mlsharp-venv", "bin", "python3");

const SKIP_DIRS = new Set([
  "__pycache__",
  ".git",
  "node_modules",
  ".cache",
  "share",
  "include",
  "lib",
  "lib64",
  "python_env",
]);

function isExecutable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return process.platform === "win32" && filePath.toLowerCase().endsWith(".exe");
  }
}

function resolveBundleRoot() {
  if (!fs.existsSync(BUNDLE_ROOT)) return null;
  const entries = fs.readdirSync(BUNDLE_ROOT, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory() && !SKIP_DIRS.has(e.name));
  if (dirs.length === 1 && !entries.some((e) => e.isFile() && e.name === "manifest.json")) {
    return path.join(BUNDLE_ROOT, dirs[0].name);
  }
  return BUNDLE_ROOT;
}

function walkFind(root, predicate, maxDepth = 8, depth = 0) {
  if (depth > maxDepth || !root || !fs.existsSync(root)) return null;
  let stat;
  try {
    stat = fs.statSync(root);
  } catch {
    return null;
  }
  if (stat.isFile() && predicate(root, stat)) return root;
  if (!stat.isDirectory()) return null;

  const base = path.basename(root);
  if (SKIP_DIRS.has(base) && depth > 0) return null;

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isFile()) {
      try {
        if (predicate(full, fs.statSync(full))) return full;
      } catch {
        /* ignore */
      }
    } else if (entry.isDirectory()) {
      const found = walkFind(full, predicate, maxDepth, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function findCheckpoint(root) {
  const preferred = path.join(root, "model_assets", "sharp_2572gikvuh.pt");
  if (fs.existsSync(preferred)) return preferred;
  return walkFind(
    root,
    (filePath, stat) => stat.isFile() && filePath.endsWith(".pt") && filePath.includes("sharp"),
    6,
  );
}

function findWindowsSharp(root) {
  const preferred = [
    path.join(root, "python_env", "Scripts", "sharp.exe"),
    path.join(root, "Scripts", "sharp.exe"),
  ];
  for (const p of preferred) {
    if (fs.existsSync(p)) return p;
  }
  return walkFind(
    root,
    (filePath, stat) => {
      const base = path.basename(filePath);
      return base === "sharp.exe" && stat.isFile();
    },
    6,
  );
}

function findWindowsPython(root) {
  const preferred = [
    path.join(root, "python_env", "python.exe"),
    path.join(root, "python_env", "Scripts", "python.exe"),
  ];
  for (const p of preferred) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function writeManifest(manifest) {
  fs.mkdirSync(BUNDLE_ROOT, { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function main() {
  const bundleRoot = resolveBundleRoot();
  const checkpoint = bundleRoot ? findCheckpoint(bundleRoot) : null;

  if (process.platform === "win32") {
    if (!bundleRoot) {
      console.error("❌ 未找到 .local/mlsharp-3d-maker，请先运行 ./scripts/download-mlsharp-3d-maker.sh");
      process.exit(1);
    }
    const sharpBin = findWindowsSharp(bundleRoot);
    if (!sharpBin) {
      console.error("❌ 未找到 sharp.exe");
      process.exit(1);
    }
    writeManifest({
      version: 2,
      runtime: "windows-bundle",
      source: "GemosDodo/MLSharp-3D-Maker-by-GemosDodo",
      root: bundleRoot,
      sharpBin,
      pythonBin: findWindowsPython(bundleRoot),
      checkpoint,
      cwd: path.dirname(sharpBin),
      installedAt: new Date().toISOString(),
    });
    console.log("✓ 已写入 manifest.json (Windows 整合包)");
    console.log(`  sharp: ${sharpBin}`);
    return;
  }

  if (isExecutable(MAC_VENV_SHARP)) {
    writeManifest({
      version: 2,
      runtime: "mac-venv",
      source: "apple/ml-sharp + GemosDodo checkpoint",
      root: bundleRoot,
      sharpBin: MAC_VENV_SHARP,
      pythonBin: fs.existsSync(MAC_VENV_PYTHON) ? MAC_VENV_PYTHON : null,
      checkpoint,
      cwd: PROJECT_ROOT,
      installedAt: new Date().toISOString(),
    });
    console.log("✓ 已写入 manifest.json (macOS 运行时)");
    console.log(`  sharp: ${MAC_VENV_SHARP}`);
    if (checkpoint) console.log(`  模型: ${checkpoint}`);
    return;
  }

  if (checkpoint) {
    writeManifest({
      version: 2,
      runtime: "pending-mac-venv",
      source: "GemosDodo/MLSharp-3D-Maker-by-GemosDodo",
      root: bundleRoot,
      sharpBin: null,
      checkpoint,
      cwd: PROJECT_ROOT,
      installedAt: new Date().toISOString(),
    });
    console.log("○ 模型权重已就绪，但 ML-Sharp 运行时未安装");
    console.log("  请运行: ./scripts/install-mlsharp-mac.sh");
    return;
  }

  console.error("❌ 未找到 MLSharp 资源，请先运行 ./scripts/download-mlsharp-3d-maker.sh");
  process.exit(1);
}

main();
