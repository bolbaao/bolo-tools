#!/bin/bash
# 在 Linux 云服务器解压 3D 模型包，并安装 ML-Sharp 运行时
#
# 用法:
#   bash scripts/unpack-mlsharp-3d.sh /path/to/mlsharp-3d-model-*.tar.gz
#   bash scripts/unpack-mlsharp-3d.sh   # 自动选用 dist/ 下最新的 mlsharp-3d-*.tar.gz
set -euo pipefail
cd "$(dirname "$0")/.."

ROOT="$(pwd)"
ARCHIVE="${1:-}"

if [ -z "$ARCHIVE" ]; then
  ARCHIVE="$(ls -t dist/mlsharp-3d-*.tar.gz 2>/dev/null | head -1 || true)"
fi

if [ -z "$ARCHIVE" ] || [ ! -f "$ARCHIVE" ]; then
  echo "用法: bash scripts/unpack-mlsharp-3d.sh <mlsharp-3d-model-*.tar.gz>"
  exit 1
fi

# 转为绝对路径
case "$ARCHIVE" in
  /*) ;;
  *) ARCHIVE="$ROOT/$ARCHIVE" ;;
esac

echo "→ 解压 3D 模型包…"
echo "  $ARCHIVE"
mkdir -p "$ROOT/.local"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

tar -xzf "$ARCHIVE" -C "$TMP"

if [ -d "$TMP/mlsharp-3d-maker" ]; then
  SRC="$TMP/mlsharp-3d-maker"
elif [ -d "$TMP/MLSharp-3D-Maker-by-GemosDodo" ]; then
  mkdir -p "$TMP/mlsharp-3d-maker/MLSharp-3D-Maker-by-GemosDodo"
  mv "$TMP/MLSharp-3D-Maker-by-GemosDodo" "$TMP/mlsharp-3d-maker/"
  SRC="$TMP/mlsharp-3d-maker"
else
  echo "❌ 压缩包结构无法识别，请用 ./scripts/pack-mlsharp-3d.sh 重新打包"
  exit 1
fi

mkdir -p "$ROOT/.local/mlsharp-3d-maker"
rsync -a "$SRC/" "$ROOT/.local/mlsharp-3d-maker/"

CHECKPOINT="$ROOT/.local/mlsharp-3d-maker/MLSharp-3D-Maker-by-GemosDodo/model_assets/sharp_2572gikvuh.pt"
if [ ! -f "$CHECKPOINT" ]; then
  echo "❌ 解压后未找到 model_assets/sharp_2572gikvuh.pt"
  exit 1
fi

echo "✓ 模型权重: $CHECKPOINT"
node scripts/write-mlsharp-manifest.mjs

if [ "$(uname -s)" != "Linux" ] && [ "$(uname -s)" != "Darwin" ]; then
  echo "⚠️  非 Linux/macOS，请手动配置 ML-Sharp 运行时"
  exit 0
fi

if [ -x "$ROOT/.local/mlsharp-venv/bin/sharp" ]; then
  echo "✓ ML-Sharp 运行时已存在，跳过安装"
  node scripts/write-mlsharp-manifest.mjs
else
  echo ""
  echo "→ 安装 Linux ML-Sharp 运行时（PyTorch + sharp，需联网，约 10–20 分钟）…"
  if [ "$(uname -s)" = "Linux" ] && [ -n "${MLSHARP_CUDA:-}" ]; then
    echo "  已启用 MLSHARP_CUDA=1（NVIDIA GPU）"
  fi
  bash scripts/install-mlsharp-mac.sh
fi

echo ""
echo "✅ 3D 工坊资源已就绪"
echo "   重启服务后访问「3D 工坊」"
echo "   预览视频: Linux 需 GPU 时在 .env 设置 MLSHARP3D_FORCE_RENDER=1"
