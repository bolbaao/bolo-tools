#!/bin/bash
# 下载 yt-dlp 官方 macOS 独立二进制到 .local/bin（避免系统 Python 3.9 + LibreSSL 的 SSL 问题）
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${YTDLP_VERSION:-2026.03.17}"
TARGET=".local/bin/yt-dlp"
ASSET="yt-dlp_macos"
URL="https://github.com/yt-dlp/yt-dlp/releases/download/${VERSION}/${ASSET}"
TMP="${TARGET}.download"

mkdir -p .local/bin

# 移除 pip 版软链接，避免覆盖失败
if [ -L "$TARGET" ] || [ -f "$TARGET" ]; then
  rm -f "$TARGET"
fi

if [ -x "$TARGET" ] && "$TARGET" --version 2>/dev/null | grep -q "$VERSION"; then
  echo "✓ yt-dlp 已是最新独立版: $("$TARGET" --version 2>/dev/null | tail -1)"
  exit 0
fi

echo "→ 下载 yt-dlp ${VERSION} (${ASSET})…"
curl -fL --retry 3 --retry-delay 2 --progress-bar -o "$TMP" "$URL"
chmod +x "$TMP"
mv "$TMP" "$TARGET"

if "$TARGET" --version >/dev/null 2>&1; then
  echo "✓ yt-dlp → ${TARGET} ($("$TARGET" --version 2>/dev/null | tail -1))"
else
  echo "❌ yt-dlp 下载后无法运行"
  exit 1
fi
