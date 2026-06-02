#!/bin/bash
# macOS / Linux：在 .local/mlsharp-venv 安装 Apple ML-Sharp，复用 GemosDodo 包内的模型权重
set -euo pipefail
cd "$(dirname "$0")/.."

ROOT="$(pwd)"
VENV="$ROOT/.local/mlsharp-venv"
UV_BIN="$ROOT/.local/bin/uv"
SRC_DIR="$ROOT/.local/ml-sharp-src"
CHECKPOINT="$ROOT/.local/mlsharp-3d-maker/MLSharp-3D-Maker-by-GemosDodo/model_assets/sharp_2572gikvuh.pt"
SHARP_BIN="$VENV/bin/sharp"

if [ -x "$SHARP_BIN" ] && "$SHARP_BIN" --help >/dev/null 2>&1; then
  echo "✓ ML-Sharp 运行时已就绪: $SHARP_BIN"
  node scripts/write-mlsharp-manifest.mjs
  exit 0
fi

if [ ! -f "$CHECKPOINT" ]; then
  echo "❌ 未找到模型权重，请先运行 ./scripts/download-mlsharp-3d-maker.sh"
  exit 1
fi

mkdir -p .local/bin .local/uv-home

if [ ! -x "$UV_BIN" ]; then
  echo "→ 下载 uv（用于安装 Python 3.11 与依赖）…"
  export UV_CONFIG_DIR="$ROOT/.local/uv-home"
  export XDG_CONFIG_HOME="$ROOT/.local/uv-home"
  export XDG_CACHE_HOME="$ROOT/.local/uv-home/cache"
  curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR="$ROOT/.local/bin" UV_NO_MODIFY_PATH=1 sh
fi

export PATH="$ROOT/.local/bin:$PATH"
export UV_CONFIG_DIR="${UV_CONFIG_DIR:-$ROOT/.local/uv-home}"
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$ROOT/.local/uv-home}"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$ROOT/.local/uv-home/cache}"
export UV_PYTHON_INSTALL_DIR="$ROOT/.local/uv-home/python"

if [ ! -x "$UV_BIN" ]; then
  echo "❌ uv 安装失败"
  exit 1
fi

echo "→ 安装 Python 3.11…"
"$UV_BIN" python install 3.11

echo "→ 创建虚拟环境 .local/mlsharp-venv …"
if [ -d "$VENV" ] && [ -x "$VENV/bin/python" ]; then
  echo "  （复用已有虚拟环境）"
else
  "$UV_BIN" venv "$VENV" --python 3.11
fi

PY="$VENV/bin/python"

if ! "$PY" -c "import torch" 2>/dev/null; then
  echo "→ 安装 PyTorch（Apple Silicon / CPU）…"
  "$UV_BIN" pip install --python "$PY" torch torchvision
else
  echo "✓ PyTorch 已安装"
fi

if ! "$PY" -c "import gsplat" 2>/dev/null; then
  echo "→ 安装 gsplat…"
  "$UV_BIN" pip install --python "$PY" gsplat
else
  echo "✓ gsplat 已安装"
fi

fetch_ml_sharp_src() {
  rm -rf "$SRC_DIR"
  mkdir -p "$SRC_DIR"
  local urls=(
    "https://ghproxy.net/https://github.com/apple/ml-sharp/archive/refs/heads/main.zip"
    "https://mirror.ghproxy.com/https://github.com/apple/ml-sharp/archive/refs/heads/main.zip"
    "https://github.com/apple/ml-sharp/archive/refs/heads/main.zip"
  )
  local zip="$ROOT/.local/tmp/ml-sharp-main.zip"
  for url in "${urls[@]}"; do
    echo "→ 下载 ML-Sharp 源码: $url"
    if curl -fL --connect-timeout 30 --retry 2 --progress-bar -o "$zip" "$url"; then
      unzip -q -o "$zip" -d "$ROOT/.local/tmp"
      rm -rf "$SRC_DIR"
      mv "$ROOT/.local/tmp/ml-sharp-main" "$SRC_DIR"
      rm -f "$zip"
      return 0
    fi
  done
  return 1
}

echo "→ 安装 ML-Sharp…"
if [ ! -f "$SRC_DIR/pyproject.toml" ]; then
  fetch_ml_sharp_src || {
    echo "❌ ML-Sharp 源码下载失败，请检查网络后重试"
    exit 1
  }
fi
"$UV_BIN" pip install --python "$PY" "$SRC_DIR"

if [ ! -x "$SHARP_BIN" ]; then
  echo "❌ sharp 命令未生成，请检查上方安装日志"
  exit 1
fi

echo "→ 写入 manifest…"
node scripts/write-mlsharp-manifest.mjs

echo "→ 启用精细度参数 patch…"
node scripts/patch-mlsharp-quality.mjs || echo "⚠️  精细度 patch 未应用，高清模式可能不可用"

echo ""
echo "✅ ML-Sharp macOS 运行时已安装"
echo "   sharp: $SHARP_BIN"
echo "   模型: $CHECKPOINT"
