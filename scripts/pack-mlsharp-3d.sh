#!/bin/bash
# 打包 3D 工坊模型，上传到腾讯云 / 宝塔后解压到项目 .local/
#
# 用法:
#   ./scripts/pack-mlsharp-3d.sh              # 精简包（仅 model_assets + manifest，约 2.7GB，Linux 云推荐）
#   ./scripts/pack-mlsharp-3d.sh --full       # 完整 .local/mlsharp-3d-maker（含 Windows python_env，约 8GB+）
#
# 本机需已下载: ./scripts/download-mlsharp-3d-maker.sh
set -euo pipefail
cd "$(dirname "$0")/.."

ROOT="$(pwd)"
OUT_DIR="dist"
FULL=0
STAMP="$(date +%Y%m%d)"
CHECKPOINT="$ROOT/.local/mlsharp-3d-maker/MLSharp-3D-Maker-by-GemosDodo/model_assets/sharp_2572gikvuh.pt"
BUNDLE_NESTED="$ROOT/.local/mlsharp-3d-maker/MLSharp-3D-Maker-by-GemosDodo"
STAGE="$OUT_DIR/.mlsharp-pack-staging"

for arg in "$@"; do
  case "$arg" in
    --full) FULL=1 ;;
  esac
done

if [ ! -f "$CHECKPOINT" ]; then
  echo "❌ 未找到模型权重，请在本机先运行:"
  echo "   ./scripts/download-mlsharp-3d-maker.sh"
  exit 1
fi

mkdir -p "$OUT_DIR"
rm -rf "$STAGE"
mkdir -p "$STAGE/mlsharp-3d-maker"

if [ "$FULL" -eq 1 ]; then
  NAME="mlsharp-3d-full-${STAMP}"
  ARCHIVE="$OUT_DIR/${NAME}.tar.gz"
  echo "→ 打包完整 MLSharp 目录（体积大，含 Windows python_env）…"
  rsync -a \
    --exclude='.cache' \
    "$ROOT/.local/mlsharp-3d-maker/" "$STAGE/mlsharp-3d-maker/"
else
  NAME="mlsharp-3d-model-${STAMP}"
  ARCHIVE="$OUT_DIR/${NAME}.tar.gz"
  echo "→ 打包精简模型（仅 model_assets，适合 Linux 云服务器）…"
  mkdir -p "$STAGE/mlsharp-3d-maker/MLSharp-3D-Maker-by-GemosDodo"
  rsync -a "$BUNDLE_NESTED/model_assets/" \
    "$STAGE/mlsharp-3d-maker/MLSharp-3D-Maker-by-GemosDodo/model_assets/"
  if [ -f "$ROOT/.local/mlsharp-3d-maker/manifest.json" ]; then
    cp "$ROOT/.local/mlsharp-3d-maker/manifest.json" "$STAGE/mlsharp-3d-maker/"
  else
    node scripts/write-mlsharp-manifest.mjs 2>/dev/null || true
    [ -f "$ROOT/.local/mlsharp-3d-maker/manifest.json" ] && \
      cp "$ROOT/.local/mlsharp-3d-maker/manifest.json" "$STAGE/mlsharp-3d-maker/"
  fi
fi

# 云端解压说明
cat > "$STAGE/INSTALL-ON-SERVER.txt" <<'EOF'
春雨集 · 3D 工坊模型包

1. 将本 tar.gz 上传到服务器项目目录（与 start-server.sh 同级）
2. 解压并安装 Linux 运行时:
   bash scripts/unpack-mlsharp-3d.sh dist/mlsharp-3d-model-*.tar.gz
3. 有 NVIDIA GPU 时可在安装前: export MLSHARP_CUDA=1
4. PM2 / start-server.sh 重启后，打开「3D 工坊」

详见 DEPLOY.md「3D 工坊 · 云端部署」
EOF

echo "→ 压缩（耗时与磁盘占用较大，请耐心等待）…"
tar -czf "$ARCHIVE" -C "$STAGE" .
rm -rf "$STAGE"

SIZE="$(du -h "$ARCHIVE" | cut -f1)"
echo ""
echo "✅ 3D 模型包: $ARCHIVE ($SIZE)"
echo ""
echo "上传到宝塔:"
echo "  文件 → /www/wwwroot/chunyu → 上传 → 解压（或 SSH 用 unpack 脚本）"
echo ""
echo "服务器安装:"
echo "  cd /www/wwwroot/chunyu"
echo "  bash scripts/unpack-mlsharp-3d.sh $(basename "$ARCHIVE")"
echo "  # 重启 PM2 / ./start-server.sh"
