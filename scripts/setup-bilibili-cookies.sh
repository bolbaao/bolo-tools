#!/bin/bash
# B 站 Cookie：导出 cookies/bilibili.txt（登录后可解析 1080P / 大会员画质）
# 用法: ./scripts/setup-bilibili-cookies.sh [chrome|safari|...]
set -e
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
BROWSER_ARG="${1:-}"

export PATH="$ROOT/.local/bin:${HOME}/Library/Python/3.9/bin:${HOME}/Library/Python/3.10/bin:${HOME}/Library/Python/3.11/bin:${HOME}/Library/Python/3.12/bin:$PATH"

pick_browser() {
  if [ -n "$BROWSER_ARG" ]; then
    echo "$BROWSER_ARG"
    return
  fi
  if [ -n "${BILIBILI_BROWSER:-}" ]; then
    echo "$BILIBILI_BROWSER"
    return
  fi
  if [ -d "/Applications/Safari.app" ]; then
    echo "safari"
    return
  fi
  echo "safari"
}

BROWSER="$(pick_browser)"
export BILIBILI_BROWSER="$BROWSER"

echo "🍍 配置 B 站 Cookie（浏览器: ${BROWSER}）"
echo ""

if ! command -v python3 >/dev/null 2>&1; then
  echo "❌ 需要 python3"
  exit 1
fi

if python3 scripts/export-bilibili-cookies.py; then
  ENV_FILE="$ROOT/.env"
  touch "$ENV_FILE"
  grep -v '^BILIBILI_COOKIES=' "$ENV_FILE" 2>/dev/null | grep -v '^BILIBILI_COOKIES_FROM_BROWSER=' | grep -v '^# B 站' > "$ENV_FILE.tmp" || true
  mv "$ENV_FILE.tmp" "$ENV_FILE"
  {
    echo ""
    echo "# B 站 Cookie（setup-bilibili-cookies.sh）"
    echo "BILIBILI_COOKIES=./cookies/bilibili.txt"
    echo "BILIBILI_COOKIES_FROM_BROWSER=${BROWSER}"
  } >> "$ENV_FILE"
  echo "✓ 已写入 .env"
else
  echo ""
  echo "⚠️  未能导出 cookies/bilibili.txt"
  echo "   解析时将尝试从 ${BROWSER} 直接读取 Cookie"
  exit 1
fi

echo ""
echo "✅ 完成。请重新运行 ./start.sh"
