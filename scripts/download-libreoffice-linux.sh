#!/bin/bash
# 将 LibreOffice 下载到项目 .local/libreoffice/（Linux 便携版）
set -euo pipefail
cd "$(dirname "$0")/.."

ROOT="$(pwd)"
TARGET_DIR="$ROOT/.local/libreoffice"
SOFFICE="$TARGET_DIR/program/soffice"

if [ -x "$SOFFICE" ]; then
  echo "✓ LibreOffice 已就绪: $SOFFICE"
  exit 0
fi

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) LO_ARCH="x86_64"; LO_SUFFIX="x86-64" ;;
  aarch64|arm64) LO_ARCH="aarch64"; LO_SUFFIX="aarch64" ;;
  *)
    echo "❌ 不支持的 CPU 架构: $ARCH"
    exit 1
    ;;
esac

VERSION="25.8.7"
TAR="LibreOffice_${VERSION}_Linux_${LO_SUFFIX}_tar.xz"
URL="https://download.documentfoundation.org/libreoffice/stable/${VERSION}/linux/${LO_ARCH}/${TAR}"
TMP_DIR="$ROOT/.local/tmp"
TAR_PATH="$TMP_DIR/$TAR"

mkdir -p "$TMP_DIR" .local

echo "→ 下载 LibreOffice ${VERSION} (${LO_ARCH})…"
echo "  $URL"
curl -fL --progress-bar -o "$TAR_PATH" "$URL"

echo "→ 解压到 .local/libreoffice …"
rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"
tar -xJf "$TAR_PATH" -C "$TARGET_DIR" --strip-components=1

if [ ! -x "$SOFFICE" ]; then
  FOUND="$(find "$TARGET_DIR" -name soffice -type f 2>/dev/null | head -1)"
  if [ -n "$FOUND" ]; then
    SOFFICE="$FOUND"
    TARGET_DIR="$(dirname "$(dirname "$FOUND")")"
    SOFFICE="$TARGET_DIR/program/soffice"
  fi
fi

if [ ! -x "$SOFFICE" ]; then
  echo "❌ 解压后未找到 program/soffice"
  exit 1
fi
chmod +x "$SOFFICE"

rm -f "$TAR_PATH"

echo ""
echo "✅ 完成"
echo "   soffice: $SOFFICE"
echo ""
echo "请在 .env 中设置："
echo "   LIBREOFFICE_PATH=.local/libreoffice/program/soffice"
