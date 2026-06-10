#!/bin/bash
# 导出小红书 Cookie，供对话内「小红书搜图」使用
set -euo pipefail
cd "$(dirname "$0")/.."

export PATH="${HOME}/Library/Python/3.9/bin:${HOME}/Library/Python/3.10/bin:${HOME}/Library/Python/3.11/bin:${HOME}/Library/Python/3.12/bin:$PATH"

if ! command -v python3 >/dev/null 2>&1; then
  echo "❌ 需要 python3"
  exit 1
fi

if ! python3 -c "import browser_cookie3" 2>/dev/null; then
  python3 -m pip install -q --user browser-cookie3
fi

python3 scripts/export-xiaohongshu-cookies.py

if ! grep -q '^XHS_COOKIES=' .env 2>/dev/null; then
  echo "XHS_COOKIES=./cookies/xiaohongshu.txt" >> .env
  echo "✓ 已写入 .env → XHS_COOKIES"
fi

echo "✓ 小红书 Cookie 已就绪，对话里可说：帮我在小红书找 XX 图片"
