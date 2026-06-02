#!/usr/bin/env node
/** 为 ML-Sharp predict 启用 MLSHARP3D_INTERNAL_SIZE 环境变量 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const TARGETS = [
  path.join(ROOT, ".local/ml-sharp-src/src/sharp/cli/predict.py"),
  path.join(ROOT, ".local/mlsharp-venv/lib/python3.11/site-packages/sharp/cli/predict.py"),
];

const OLD = "    internal_shape = (1536, 1536)";
const NEW = `    import os as _os
    _internal = int(_os.environ.get("MLSHARP3D_INTERNAL_SIZE", "1536"))
    _internal = max(1024, min(_internal, 2048))
    internal_shape = (_internal, _internal)`;

let patched = 0;
for (const file of TARGETS) {
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, "utf8");
  if (text.includes("MLSHARP3D_INTERNAL_SIZE")) {
    patched++;
    continue;
  }
  if (!text.includes(OLD)) {
    console.warn(`⚠️  跳过（未找到替换点）: ${file}`);
    continue;
  }
  fs.writeFileSync(file, text.replace(OLD, NEW), "utf8");
  patched++;
  console.log(`✓ 已 patch: ${file}`);
}

if (patched === 0) process.exit(1);
