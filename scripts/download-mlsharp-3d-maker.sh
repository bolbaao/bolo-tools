#!/bin/bash
# 下载并解压 Hugging Face 上的 MLSharp-3D-Maker-by-GemosDodo（约 5.4 GB）
set -euo pipefail
cd "$(dirname "$0")/.."

ROOT="$(pwd)"
TARGET="$ROOT/.local/mlsharp-3d-maker"
ZIP="$ROOT/.local/tmp/mlsharp-3d-maker.zip"
URL="${MLSHARP3D_DOWNLOAD_URL:-https://hf-mirror.com/GemosDodo/MLSharp-3D-Maker-by-GemosDodo/resolve/main/MLSharp-3D-Maker-by-GemosDodo.zip}"

if [ -f "$TARGET/manifest.json" ]; then
  echo "✓ MLSharp 3D Maker 已就绪: $TARGET"
  node scripts/write-mlsharp-manifest.mjs 2>/dev/null || true
  exit 0
fi

mkdir -p "$ROOT/.local/tmp"

echo "→ 下载 MLSharp 3D Maker（约 5.4 GB，首次较慢）…"
echo "  $URL"
curl -fL --connect-timeout 30 --retry 3 --continue-at - --progress-bar -o "$ZIP" "$URL"

echo ""
echo "→ 解压到 .local/mlsharp-3d-maker …"
rm -rf "$TARGET"
mkdir -p "$TARGET"
unzip -q "$ZIP" -d "$TARGET"

node scripts/write-mlsharp-manifest.mjs

if [ "$(uname -s)" = "Darwin" ] || [ "$(uname -s)" = "Linux" ]; then
  echo ""
  echo "→ 安装本机 ML-Sharp 运行时（整合包为 Windows 版，需单独安装 macOS/Linux 依赖）…"
  bash scripts/install-mlsharp-mac.sh || echo "⚠️  运行时安装未完成，可稍后手动运行: ./scripts/install-mlsharp-mac.sh"
fi

echo ""
echo "✅ MLSharp 3D Maker 安装完成"
echo "   目录: $TARGET"
echo "   重启 ./start.sh 后即可在「3D 工坊」使用"
