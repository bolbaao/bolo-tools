#!/bin/bash
# 打包春雨集，便于上传到 Linux 云服务器
# 用法:
#   ./scripts/pack-for-server.sh              # 源码包（到服务器再 npm ci + install-deps-linux）
#   ./scripts/pack-for-server.sh --docker     # 在 Mac 上用 Docker 构建 linux/amd64 完整运行包（推荐）
#   ./scripts/pack-for-server.sh --docker --full   # 含 LibreOffice + Whisper 模型（体积更大）
set -euo pipefail
cd "$(dirname "$0")/.."

ROOT="$(pwd)"
MODE="source"
DOCKER=0
FULL=0
OUT_DIR="dist"

for arg in "$@"; do
  case "$arg" in
    --docker) DOCKER=1; MODE="bundle" ;;
    --full) FULL=1 ;;
    --bundle) MODE="bundle" ;;
  esac
done

STAMP="$(date +%Y%m%d)"
GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo nogit)"
NAME="pineapple-toolbox-${STAMP}-${GIT_SHA}"

mkdir -p "$OUT_DIR"

pack_source() {
  local ARCHIVE="$OUT_DIR/${NAME}-source.tar.gz"
  echo "→ 打包源码（不含 node_modules / out / .local）…"
  tar -czf "$ARCHIVE" \
    --exclude='./node_modules' \
    --exclude='./.next' \
    --exclude='./out' \
    --exclude='./.local' \
    --exclude='./.node-portable' \
    --exclude='./data' \
    --exclude='./dist' \
    --exclude='./.git' \
    --exclude='./.env' \
    --exclude='./cookies/*.txt' \
    -C "$ROOT" \
    .
  echo ""
  echo "✅ 源码包: $ARCHIVE"
  echo "   上传到服务器后："
  echo "   tar -xzf $(basename "$ARCHIVE") -C /opt/pineapple-toolbox"
  echo "   cd /opt/pineapple-toolbox && cp .env.example .env && nano .env"
  echo "   npm ci && npm run build && ./scripts/install-deps-linux.sh --full"
  echo "   ./start-server.sh"
}

pack_bundle_native() {
  if [ "$(uname -s)" != "Linux" ]; then
    echo "❌ 完整运行包需在 Linux 上构建，或使用: ./scripts/pack-for-server.sh --docker"
    exit 1
  fi
  bash scripts/pack-bundle-inner.sh "$NAME" "$FULL"
}

pack_bundle_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "❌ 未找到 docker，请安装 Docker Desktop 或在 Linux 服务器上直接打包"
    exit 1
  fi
  local FULL_FLAG=""
  [ "$FULL" -eq 1 ] && FULL_FLAG="--full"
  echo "→ 使用 Docker (linux/amd64) 构建运行包…"
  docker run --rm --platform linux/amd64 \
    -v "$ROOT:/app" -w /app \
    -e PACK_NAME="$NAME" \
    -e PACK_FULL="$FULL" \
    node:22-bookworm \
    bash -c '
      set -euo pipefail
      apt-get update -qq
      DEBIAN_FRONTEND=noninteractive apt-get install -y -qq curl ca-certificates python3 python3-venv xz-utils git rsync >/dev/null
      npm ci
      npm run build
      FULL_FLAG=""
      [ "${PACK_FULL:-0}" = "1" ] && FULL_FLAG="--full"
      if [ "${PACK_FULL:-0}" = "1" ]; then
        bash scripts/install-deps-linux.sh --full
      else
        bash scripts/install-deps-linux.sh --minimal
      fi
      bash scripts/pack-bundle-inner.sh "$PACK_NAME" "${PACK_FULL:-0}"
    '
  local ARCHIVE="$OUT_DIR/${NAME}-linux-amd64.tar.gz"
  if [ -f "$ARCHIVE" ]; then
    echo ""
    echo "✅ 运行包: $ARCHIVE"
    echo "   上传解压后编辑 .env，执行: ./start-server.sh"
    ls -lh "$ARCHIVE"
  fi
}

case "$MODE" in
  source) pack_source ;;
  bundle)
    if [ "$DOCKER" -eq 1 ]; then
      pack_bundle_docker
    else
      pack_bundle_native
    fi
    ;;
esac
