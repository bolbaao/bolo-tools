#!/bin/bash
# X (Twitter) Cookie：导出 cookies/x.txt（登录后可解析需鉴权的视频帖）
# 用法: ./scripts/setup-x-cookies.sh [chrome|safari|...]
set -e
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
BROWSER_ARG="${1:-}"

export PATH="$ROOT/.local/bin:${HOME}/Library/Python/3.9/bin:${HOME}/Library/Python/3.10/bin:${HOME}/Library/Python/3.11/bin:${HOME}/Library/Python/3.12/bin:$PATH"

BROWSER="${BROWSER_ARG:-${TWITTER_BROWSER:-chrome}}"
export TWITTER_BROWSER="$BROWSER"

echo "🍍 配置 X Cookie（浏览器: ${BROWSER}）"
echo ""

if ! command -v python3 >/dev/null 2>&1; then
  echo "❌ 需要 python3"
  exit 1
fi

if python3 scripts/export-x-cookies.py; then
  ENV_FILE="$ROOT/.env"
  touch "$ENV_FILE"
  grep -v '^TWITTER_COOKIES=' "$ENV_FILE" 2>/dev/null | grep -v '^TWITTER_COOKIES_FROM_BROWSER=' | grep -v '^# X ' > "$ENV_FILE.tmp" || true
  mv "$ENV_FILE.tmp" "$ENV_FILE"
  {
    echo ""
    echo "# X Cookie（setup-x-cookies.sh）"
    echo "TWITTER_COOKIES=./cookies/x.txt"
    echo "TWITTER_COOKIES_FROM_BROWSER=${BROWSER}"
  } >> "$ENV_FILE"
  echo "✓ 已写入 .env"
else
  echo ""
  echo "⚠️  未能导出 cookies/x.txt"
  echo "   解析时将尝试从 ${BROWSER} 直接读取 Cookie"
  echo "   请确认：① ${BROWSER} 已登录 x.com  ② 完全退出浏览器后再解析（Cmd+Q）"
  exit 1
fi

echo ""
echo "✅ 完成。请重新运行 ./start.sh"
