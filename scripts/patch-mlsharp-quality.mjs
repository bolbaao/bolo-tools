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
const OLD_PATCHED_V1 = `    import os as _os
    _internal = int(_os.environ.get("MLSHARP3D_INTERNAL_SIZE", "1536"))
    _internal = max(1024, min(_internal, 2048))
    internal_shape = (_internal, _internal)`;
const OLD_PATCHED_V2 = `    import os as _os
    _raw = int(_os.environ.get("MLSHARP3D_INTERNAL_SIZE", "1536"))
    _raw = max(384, min(_raw, 2112))
    _patch_stride = 288  # patch_size=384, overlap_ratio=0.25
    _steps = (_raw - 384) // _patch_stride + 1
    _internal = (_steps - 1) * _patch_stride + 384
    internal_shape = (_internal, _internal)`;
const NEW = `    import os as _os
    _raw = int(_os.environ.get("MLSHARP3D_INTERNAL_SIZE", "1536"))
    _raw = max(384, min(_raw, 2112))
    _patch = 384
    _internal = _patch
    for _candidate in range(_patch, _raw + 1):
        _s1 = _candidate // 2
        if _candidate % 2 != 0:
            continue
        if (_candidate - _patch) % 288 != 0:
            continue
        if (_s1 - _patch) % 192 != 0:
            continue
        _internal = _candidate
    internal_shape = (_internal, _internal)`;

let patched = 0;
for (const file of TARGETS) {
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, "utf8");
  if (text.includes("for _candidate in range(_patch, _raw + 1):")) {
    patched++;
    continue;
  }
  if (text.includes(OLD_PATCHED_V2) || text.includes(OLD_PATCHED_V1)) {
    const next = text.includes(OLD_PATCHED_V2)
      ? text.replace(OLD_PATCHED_V2, NEW)
      : text.replace(OLD_PATCHED_V1, NEW);
    fs.writeFileSync(file, next, "utf8");
    patched++;
    console.log(`✓ 已升级 patch: ${file}`);
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
