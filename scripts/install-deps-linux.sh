#!/bin/bash
# Linux 云服务器：安装项目内便携依赖到 .local/
set -euo pipefail
cd "$(dirname "$0")/.."

ROOT="$(pwd)"
MINIMAL=0
WITH_LIBREOFFICE=0
WITH_WHISPER_MODEL=0

for arg in "$@"; do
  case "$arg" in
    --minimal) MINIMAL=1 ;;
    --with-libreoffice) WITH_LIBREOFFICE=1 ;;
    --with-whisper-model) WITH_WHISPER_MODEL=1 ;;
    --full)
      WITH_LIBREOFFICE=1
      WITH_WHISPER_MODEL=1
      ;;
  esac
done

echo "🍍 安装 Linux 依赖（项目目录 .local/）…"
mkdir -p .local/bin

# yt-dlp 独立二进制
if [ -x ".local/bin/yt-dlp" ] && .local/bin/yt-dlp --version >/dev/null 2>&1; then
  echo "✓ yt-dlp: .local/bin/yt-dlp"
else
  bash scripts/download-ytdlp.sh
fi

# ffmpeg / ffprobe：npm 包（按当前 Linux 架构）
if [ -x ".local/bin/ffmpeg" ]; then
  echo "✓ ffmpeg: .local/bin/ffmpeg"
else
  echo "→ 链接 npm 自带的 ffmpeg/ffprobe…"
  if [ ! -d node_modules/@ffmpeg-installer/ffmpeg ]; then
    npm install --no-save @ffmpeg-installer/ffmpeg @ffprobe-installer/ffprobe
  fi
  FFMPEG_PATH="$(node -e "console.log(require('@ffmpeg-installer/ffmpeg').path)" 2>/dev/null || true)"
  FFPROBE_PATH="$(node -e "console.log(require('@ffprobe-installer/ffprobe').path)" 2>/dev/null || true)"
  if [ -n "$FFMPEG_PATH" ] && [ -f "$FFMPEG_PATH" ]; then
    ln -sf "$FFMPEG_PATH" .local/bin/ffmpeg
    echo "✓ ffmpeg → .local/bin/ffmpeg"
  else
    echo "⚠️  ffmpeg 未就绪，请确认已 npm install"
  fi
  if [ -n "$FFPROBE_PATH" ] && [ -f "$FFPROBE_PATH" ]; then
    ln -sf "$FFPROBE_PATH" .local/bin/ffprobe
    echo "✓ ffprobe → .local/bin/ffprobe"
  fi
fi

# Python 虚拟环境（字幕、口播 TTS 等）
VENV="$ROOT/.local/python-venv"
if [ -x "$VENV/bin/python3" ]; then
  echo "✓ Python 虚拟环境: $VENV"
else
  if ! command -v python3 >/dev/null 2>&1; then
    echo "❌ 需要 python3，请安装: apt install python3 python3-venv  或  yum install python3"
    exit 1
  fi
  echo "→ 创建 Python 虚拟环境…"
  python3 -m venv "$VENV"
fi
"$VENV/bin/pip" install -q -U pip
PKGS="faster-whisper edge-tts zhconv browser_cookie3"
if [ "$MINIMAL" -eq 0 ]; then
  PKGS="$PKGS playwright"
fi
echo "→ pip 安装: $PKGS"
"$VENV/bin/pip" install -q $PKGS

if [ "$MINIMAL" -eq 0 ] && "$VENV/bin/python3" -c "import playwright" 2>/dev/null; then
  export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$ROOT/.local/ms-playwright}"
  "$VENV/bin/python3" -m playwright install chromium 2>/dev/null || true
fi

if ! grep -q '^PYTHON_BIN=' .env 2>/dev/null; then
  echo "PYTHON_BIN=.local/python-venv/bin/python3" >> .env
  echo "✓ 已写入 .env → PYTHON_BIN"
fi

# LibreOffice（PDF ↔ Word，体积较大）
if [ "$WITH_LIBREOFFICE" -eq 1 ] || [ "$MINIMAL" -eq 0 ]; then
  if [ -x ".local/libreoffice/program/soffice" ]; then
    echo "✓ LibreOffice: .local/libreoffice/program/soffice"
  else
    echo "→ 下载 LibreOffice（约 250MB）…"
    if bash scripts/download-libreoffice-linux.sh; then
      if ! grep -q '^LIBREOFFICE_PATH=' .env 2>/dev/null; then
        echo "LIBREOFFICE_PATH=.local/libreoffice/program/soffice" >> .env
        echo "✓ 已写入 .env → LIBREOFFICE_PATH"
      fi
    else
      echo "⚠️  LibreOffice 下载失败；PDF↔Word 可改用 .env 中的 CONVERTAPI_SECRET"
    fi
  fi
fi

# Whisper 模型
if [ "$WITH_WHISPER_MODEL" -eq 1 ]; then
  if [ -f ".local/whisper/base/model.bin" ]; then
    echo "✓ Whisper 模型已存在"
  elif [ -f "scripts/download-whisper-model.sh" ]; then
    bash scripts/download-whisper-model.sh
  fi
fi

# PDF.js worker
PDF_WORKER_SRC="node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs"
if [ -f "$PDF_WORKER_SRC" ]; then
  mkdir -p public/static
  cp -f "$PDF_WORKER_SRC" public/static/pdf.worker.min.mjs
fi

echo ""
echo "✅ Linux 依赖安装完成"
echo "   PATH 需包含: $ROOT/.local/bin"
echo "   Python: $VENV/bin/python3"
