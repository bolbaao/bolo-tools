#!/bin/bash
# 下载 faster-whisper base 模型到 .local/whisper/base（约 150MB）
set -euo pipefail
cd "$(dirname "$0")/.."

MODEL="${WHISPER_MODEL:-base}"
TARGET=".local/whisper/${MODEL}"
REPO="Systran/faster-whisper-${MODEL}"
MIRROR="${HF_ENDPOINT:-https://hf-mirror.com}"

mkdir -p "$TARGET"

download_file() {
  local file="$1"
  local dest="$TARGET/$file"
  if [ -f "$dest" ] && [ -s "$dest" ]; then
    echo "✓ 已存在: $dest"
    return 0
  fi
  echo "→ 下载 $file …"
  curl -fL --retry 3 --retry-delay 2 --progress-bar \
    -o "$dest" \
    "${MIRROR}/${REPO}/resolve/main/${file}"
}

echo "🍍 下载 Whisper ${MODEL} 模型 → ${TARGET}"
echo "   镜像: ${MIRROR}"

download_file config.json
download_file tokenizer.json
download_file vocabulary.txt
download_file model.bin

if [ ! -s "$TARGET/model.bin" ]; then
  echo "❌ model.bin 下载失败"
  exit 1
fi

if ! grep -q '^WHISPER_MODEL_PATH=' .env 2>/dev/null; then
  echo "WHISPER_MODEL_PATH=.local/whisper/${MODEL}" >> .env
  echo "✓ 已写入 .env → WHISPER_MODEL_PATH=.local/whisper/${MODEL}"
fi

echo ""
echo "✅ Whisper ${MODEL} 模型已就绪: $(pwd)/${TARGET}"
