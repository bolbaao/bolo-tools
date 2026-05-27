#!/bin/bash
# 将 LibreOffice 下载到项目 .local/（不占用系统 /Applications，无需 brew install）
set -euo pipefail
cd "$(dirname "$0")/.."

ROOT="$(pwd)"
TARGET_APP="$ROOT/.local/LibreOffice.app"
SOFFICE="$TARGET_APP/Contents/MacOS/soffice"

if [ -x "$SOFFICE" ]; then
  echo "✓ LibreOffice 已就绪: $SOFFICE"
  exit 0
fi

ARCH="$(uname -m)"
if [ "$ARCH" = "arm64" ]; then
  LO_ARCH="aarch64"
else
  LO_ARCH="x86_64"
fi

VERSION="25.8.7"
DMG="LibreOffice_${VERSION}_MacOS_${LO_ARCH}.dmg"
URL="https://download.documentfoundation.org/libreoffice/stable/${VERSION}/mac/${LO_ARCH}/${DMG}"
TMP_DIR="$ROOT/.local/tmp"
DMG_PATH="$TMP_DIR/$DMG"

mkdir -p "$TMP_DIR" .local

echo "→ 下载 LibreOffice ${VERSION} (${LO_ARCH})…"
echo "  $URL"
curl -fL --progress-bar -o "$DMG_PATH" "$URL"

echo "→ 解压到 .local/LibreOffice.app …"
MOUNT_OUT="$(hdiutil attach -nobrowse -readonly "$DMG_PATH")"
MOUNT_VOL="$(echo "$MOUNT_OUT" | grep '/Volumes/' | tail -1 | awk '{print $NF}')"
if [ -z "$MOUNT_VOL" ] || [ ! -d "$MOUNT_VOL/LibreOffice.app" ]; then
  echo "❌ 无法从 DMG 找到 LibreOffice.app"
  exit 1
fi
cleanup() {
  hdiutil detach "$MOUNT_VOL" -quiet 2>/dev/null || true
}
trap cleanup EXIT

rm -rf "$TARGET_APP"
cp -R "$MOUNT_VOL/LibreOffice.app" "$TARGET_APP"
chmod +x "$SOFFICE"

rm -f "$DMG_PATH"
trap - EXIT

echo ""
echo "✅ 完成（项目内便携版，未写入 /Applications）"
echo "   soffice: $SOFFICE"
echo ""
echo "请在 .env 中设置（若尚未设置）："
echo "   LIBREOFFICE_PATH=$SOFFICE"
