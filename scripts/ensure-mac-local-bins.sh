#!/bin/bash
# 将 .local/bin 中的 Linux 二进制换成本机 Mac 可执行文件（yt-dlp / ffmpeg / ffprobe）
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "$(uname -s)" != "Darwin" ]; then
  exit 0
fi

mkdir -p .local/bin

bin_runs() {
  local bin="$1"
  shift
  [ -n "$bin" ] && [ -e "$bin" ] && [ -x "$bin" ] && "$bin" "$@" >/dev/null 2>&1
}

bin_needs_fix() {
  local bin="$1"
  local probe="${2:---version}"
  if [ ! -e "$bin" ]; then
    return 0
  fi
  if file -b "$bin" 2>/dev/null | grep -q 'ELF'; then
    return 0
  fi
  if ! bin_runs "$bin" $probe; then
    return 0
  fi
  return 1
}

link_npm_ffmpeg() {
  local pkg="$1"
  local name="$2"
  local target=".local/bin/$name"
  local resolved=""

  if ! bin_needs_fix "$target" "-version"; then
    echo "✓ $name 已就绪: $target"
    return 0
  fi

  rm -f "$target"
  if [ -d node_modules ] && command -v node >/dev/null 2>&1; then
    resolved="$(node -e "try{console.log(require('$pkg').path)}catch{process.exit(1)}" 2>/dev/null || true)"
  fi
  if [ -n "$resolved" ] && [ -f "$resolved" ]; then
    ln -sf "$resolved" "$target"
    echo "✓ $name → $resolved"
    return 0
  fi

  if command -v "$name" >/dev/null 2>&1; then
    ln -sf "$(command -v "$name")" "$target"
    echo "✓ $name → $(command -v "$name")"
    return 0
  fi

  echo "⚠️  $name 未就绪，请运行: npm install 或 brew install ffmpeg"
  return 1
}

fix_ytdlp() {
  local target=".local/bin/yt-dlp"

  if ! bin_needs_fix "$target" "--version"; then
    echo "✓ yt-dlp 已就绪: $target ($("$target" --version 2>/dev/null | tail -1))"
    return 0
  fi

  rm -f "$target"
  if [ -f ".local/bin/yt-dlp.download" ]; then
    chmod +x ".local/bin/yt-dlp.download"
    mv -f ".local/bin/yt-dlp.download" "$target"
    if bin_runs "$target" --version; then
      echo "✓ yt-dlp → $target ($("$target" --version 2>/dev/null | tail -1))"
      return 0
    fi
    rm -f "$target"
  fi

  local pip_bin
  for pip_bin in \
    "${HOME}/Library/Python/3.13/bin/yt-dlp" \
    "${HOME}/Library/Python/3.12/bin/yt-dlp" \
    "${HOME}/Library/Python/3.11/bin/yt-dlp" \
    "${HOME}/Library/Python/3.10/bin/yt-dlp" \
    "${HOME}/Library/Python/3.9/bin/yt-dlp"; do
    if [ -x "$pip_bin" ] && bin_runs "$pip_bin" --version; then
      ln -sf "$pip_bin" "$target"
      echo "✓ yt-dlp → $pip_bin"
      return 0
    fi
  done

  if command -v yt-dlp >/dev/null 2>&1 && bin_runs "$(command -v yt-dlp)" --version; then
    ln -sf "$(command -v yt-dlp)" "$target"
    echo "✓ yt-dlp → $(command -v yt-dlp)"
    return 0
  fi

  echo "⚠️  yt-dlp 未就绪，可运行: bash scripts/download-ytdlp.sh"
  return 1
}

fix_ytdlp || true
link_npm_ffmpeg "@ffmpeg-installer/ffmpeg" "ffmpeg" || true
link_npm_ffmpeg "@ffprobe-installer/ffprobe" "ffprobe" || true
