#!/bin/bash
# 安装本项目所需本机依赖（macOS）
set -e
cd "$(dirname "$0")/.."

echo "🍍 安装本机依赖…"
mkdir -p .local/bin

# yt-dlp（优先官方 macOS 独立二进制，避免系统 Python 3.9 + LibreSSL 导致 SSL 握手失败）
if [ -x ".local/bin/yt-dlp" ] && .local/bin/yt-dlp --version >/dev/null 2>&1; then
  echo "✓ yt-dlp 已存在: .local/bin/yt-dlp ($(.local/bin/yt-dlp --version 2>/dev/null | tail -1))"
elif command -v brew >/dev/null 2>&1 && brew list yt-dlp >/dev/null 2>&1; then
  echo "✓ yt-dlp 已存在: $(command -v yt-dlp)"
elif bash scripts/download-ytdlp.sh; then
  :
else
  echo "→ 独立版下载失败，尝试 pip 安装 yt-dlp…"
  python3 -m pip install --user -U yt-dlp
  PY_BIN="$(python3 -m site --user-base 2>/dev/null)/bin"
  if [ -x "$PY_BIN/yt-dlp" ]; then
    ln -sf "$PY_BIN/yt-dlp" .local/bin/yt-dlp
    echo "✓ yt-dlp → .local/bin/yt-dlp (pip)"
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
    echo "→ 通过 npm 安装 ffmpeg/ffprobe 二进制…"
    export PATH="$(pwd)/.node-portable/bin:$PATH"
    npm install @ffmpeg-installer/ffmpeg @ffprobe-installer/ffprobe --save
    echo "✓ ffmpeg/ffprobe 已随项目 npm 依赖安装，启动时自动使用"
  fi
fi

# LibreOffice（文档转换，下载到 .local，不装系统级）
LOCAL_SOFFICE="$(pwd)/.local/LibreOffice.app/Contents/MacOS/soffice"
if [ -x "$LOCAL_SOFFICE" ]; then
  echo "✓ LibreOffice 已存在: $LOCAL_SOFFICE"
else
  echo "→ 文档转换需要 LibreOffice（将下载到 .local，约 300MB）…"
  if bash scripts/download-libreoffice.sh; then
    if ! grep -q '^LIBREOFFICE_PATH=' .env 2>/dev/null; then
      echo "LIBREOFFICE_PATH=.local/LibreOffice.app/Contents/MacOS/soffice" >> .env
      echo "✓ 已写入 .env → LIBREOFFICE_PATH"
    fi
  else
    echo "⚠️  LibreOffice 下载失败，可稍后手动运行: ./scripts/download-libreoffice.sh"
  fi
fi

# faster-whisper（字幕工坊 · 本地语音转写）
if python3 -c "import faster_whisper" 2>/dev/null; then
  echo "✓ faster-whisper 已安装"
else
  echo "→ 安装 faster-whisper (pip)…"
  python3 -m pip install --user faster-whisper
  if python3 -c "import faster_whisper" 2>/dev/null; then
    echo "✓ faster-whisper 已安装（首次转写会自动下载模型）"
  else
    echo "⚠️  faster-whisper 安装失败，字幕转写需手动: python3 -m pip install --user faster-whisper"
  fi
fi

# edge-tts（AI 剪口播 · 人声合成）
if python3 -c "import edge_tts" 2>/dev/null; then
  echo "✓ edge-tts 已安装"
else
  echo "→ 安装 edge-tts (pip)…"
  python3 -m pip install --user edge-tts
  if python3 -c "import edge_tts" 2>/dev/null; then
    echo "✓ edge-tts 已安装（AI 剪口播可用）"
  else
    echo "⚠️  edge-tts 安装失败，口播合成需手动: python3 -m pip install --user edge-tts"
  fi
fi

# playwright（社媒分发 · 抖音全自动，可选）
if python3 -c "import playwright" 2>/dev/null; then
  echo "✓ playwright 已安装"
else
  echo "→ 安装 playwright（抖音全自动发布，可选）…"
  python3 -m pip install --user playwright 2>/dev/null || true
  if python3 -c "import playwright" 2>/dev/null; then
    python3 -m playwright install chromium 2>/dev/null || true
    echo "✓ playwright 已安装（抖音全自动可用）"
  else
    echo "⚠️  playwright 未安装，抖音全自动需: python3 -m pip install --user playwright && playwright install chromium"
  fi
fi

# zhconv（繁体转简体，与 Node opencc-js 双保险）
if python3 -c "import zhconv" 2>/dev/null; then
  echo "✓ zhconv 已安装"
else
  echo "→ 安装 zhconv (pip)…"
  python3 -m pip install --user zhconv 2>/dev/null || true
fi

# MLSharp 3D Maker（3D 工坊，可选，约 5.4 GB 模型包）
if [ -f ".local/mlsharp-3d-maker/manifest.json" ] && [ -x ".local/mlsharp-venv/bin/sharp" ]; then
  echo "✓ MLSharp 3D 已就绪（模型 + macOS 运行时）"
elif [ -f ".local/mlsharp-3d-maker/MLSharp-3D-Maker-by-GemosDodo/model_assets/sharp_2572gikvuh.pt" ]; then
  echo "○ MLSharp 模型已下载，运行时未安装 → ./scripts/install-mlsharp-mac.sh"
else
  echo "○ MLSharp 3D 未安装 → ./scripts/download-mlsharp-3d-maker.sh"
fi

echo ""
echo "✅ 完成。启动前请确保 PATH 包含："
echo "   $(pwd)/.local/bin"
echo "   ~/Library/Python/*/bin （若用 pip 安装 yt-dlp）"
echo ""
echo "运行 ./start.sh 时会自动加入上述路径。"
