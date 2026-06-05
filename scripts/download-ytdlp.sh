#!/bin/bash
# 下载 yt-dlp 官方独立二进制到 .local/bin（macOS / Linux）
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${YTDLP_VERSION:-2026.03.17}"
TARGET=".local/bin/yt-dlp"

OS="$(uname -s)"
ARCH="$(uname -m)"
case "$OS" in
  Darwin) ASSET="yt-dlp_macos" ;;
  Linux)
    case "$ARCH" in
      x86_64|amd64) ASSET="yt-dlp_linux" ;;
      aarch64|arm64) ASSET="yt-dlp_linux_aarch64" ;;
      *)
        echo "❌ Linux 不支持的架构: $ARCH"
        exit 1
        ;;
    esac
    ;;
  *)
    echo "❌ 仅支持 macOS / Linux，当前: $OS"
    exit 1
    ;;
esac

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
