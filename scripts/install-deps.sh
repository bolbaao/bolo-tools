#!/bin/bash
# 安装菠萝工具箱所需本机依赖（macOS）
set -e
cd "$(dirname "$0")/.."

echo "🍍 安装本机依赖…"
mkdir -p .local/bin

# yt-dlp
if command -v yt-dlp >/dev/null 2>&1; then
  echo "✓ yt-dlp 已存在: $(command -v yt-dlp)"
else
  echo "→ 安装 yt-dlp (pip)…"
  python3 -m pip install --user yt-dlp
  PY_BIN="$(python3 -m site --user-base 2>/dev/null)/bin"
  if [ -x "$PY_BIN/yt-dlp" ]; then
    ln -sf "$PY_BIN/yt-dlp" .local/bin/yt-dlp
    echo "✓ yt-dlp → .local/bin/yt-dlp"
  fi
fi

# ffmpeg：优先 Homebrew，否则用 npm 包
if command -v ffmpeg >/dev/null 2>&1; then
  echo "✓ ffmpeg 已存在: $(command -v ffmpeg)"
elif [ -x ".local/bin/ffmpeg" ]; then
  echo "✓ ffmpeg 已存在: .local/bin/ffmpeg"
else
  if [ -x /opt/homebrew/bin/brew ] || [ -x /usr/local/bin/brew ]; then
  BREW="$(command -v brew 2>/dev/null || echo /opt/homebrew/bin/brew)"
  [ -x "$BREW" ] || BREW=/usr/local/bin/brew
  echo "→ brew install ffmpeg…"
  "$BREW" install ffmpeg
  else
    echo "→ 通过 npm 安装 ffmpeg 二进制 (@ffmpeg-installer/ffmpeg)…"
    export PATH="$(pwd)/.node-portable/bin:$PATH"
    npm install @ffmpeg-installer/ffmpeg --save
    echo "✓ ffmpeg 已随项目 npm 依赖安装，启动时自动使用"
  fi
fi

# Grok CLI（闲聊对话，可选）
if command -v grok >/dev/null 2>&1; then
  echo "✓ grok CLI 已存在: $(command -v grok)"
else
  echo "→ 闲聊对话可用 Grok CLI（可选）："
  echo "   ./scripts/install-grok-cli.sh && grok login"
  echo "   然后在 .env 设置 GROK_USE_CLI=1"
fi

echo ""
echo "✅ 完成。启动前请确保 PATH 包含："
echo "   $(pwd)/.local/bin"
echo "   ~/Library/Python/*/bin （若用 pip 安装 yt-dlp）"
echo ""
echo "运行 ./start.sh 时会自动加入上述路径。"
