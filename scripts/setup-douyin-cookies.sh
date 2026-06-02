#!/bin/bash
# 一键配置「长期可用」的抖音 Cookie：导出文件 + 可选每日自动刷新
# 用法: ./scripts/setup-douyin-cookies.sh [chrome|safari|...] [--cron]
set -e
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
CRON_MODE=false
BROWSER_ARG=""

for arg in "$@"; do
  if [[ "$arg" == "--cron" ]]; then
    CRON_MODE=true
  elif [[ -n "$arg" && "$arg" != "--cron" ]]; then
    BROWSER_ARG="$arg"
  fi
done

export PATH="$ROOT/.local/bin:${HOME}/Library/Python/3.9/bin:${HOME}/Library/Python/3.10/bin:${HOME}/Library/Python/3.11/bin:${HOME}/Library/Python/3.12/bin:$PATH"

pick_browser() {
  if [ -n "$BROWSER_ARG" ]; then
    echo "$BROWSER_ARG"
    return
  fi
  if [ -n "${DOUYIN_BROWSER:-}" ]; then
    echo "$DOUYIN_BROWSER"
    return
  fi
  if [ -d "/Applications/Safari.app" ]; then
    echo "safari"
    return
  fi
  echo "safari"
}

BROWSER="$(pick_browser)"
export DOUYIN_BROWSER="$BROWSER"

if ! $CRON_MODE; then
  echo "🍍 配置抖音 Cookie（浏览器: ${BROWSER}）"
  echo ""
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "❌ 需要 python3"
  exit 1
fi

if ! command -v yt-dlp >/dev/null 2>&1; then
  python3 -m pip install -q -U yt-dlp
fi

if python3 scripts/export-douyin-cookies.py; then
  COOKIE_MODE="file"
else
  echo ""
  echo "⚠️  未能导出 cookies/douyin.txt"
  echo "   将使用「解析时从 ${BROWSER} 读取 Cookie」。"
  echo "   请确认：① ${BROWSER} 已登录 douyin.com  ② 终端有「完全磁盘访问权限」"
  COOKIE_MODE="browser"
  rm -f "$ROOT/cookies/douyin.txt"
fi

ENV_FILE="$ROOT/.env"
touch "$ENV_FILE"
grep -v '^YTDLP_COOKIES=' "$ENV_FILE" 2>/dev/null | grep -v '^YTDLP_COOKIES_FROM_BROWSER=' | grep -v '^# 抖音' > "$ENV_FILE.tmp" || true
mv "$ENV_FILE.tmp" "$ENV_FILE"

if [ "$COOKIE_MODE" = "file" ]; then
  {
    echo ""
    echo "# 抖音 Cookie（setup-douyin-cookies.sh 自动维护）"
    echo "YTDLP_COOKIES=./cookies/douyin.txt"
    echo "YTDLP_COOKIES_FROM_BROWSER=${BROWSER}"
  } >> "$ENV_FILE"
  $CRON_MODE || echo "✓ 已写入 .env → YTDLP_COOKIES + YTDLP_COOKIES_FROM_BROWSER=${BROWSER}"
else
  {
    echo ""
    echo "# 抖音：解析时从浏览器读取 Cookie（${BROWSER}）"
    echo "YTDLP_COOKIES_FROM_BROWSER=${BROWSER}"
  } >> "$ENV_FILE"
  $CRON_MODE || echo "✓ 已写入 .env → YTDLP_COOKIES_FROM_BROWSER=${BROWSER}"
  $CRON_MODE || echo "   解析前请完全退出 ${BROWSER}（Cmd+Q）"
fi

if $CRON_MODE; then
  exit 0
fi

read -r -p "是否安装「每天 8:00 自动刷新 Cookie」计划任务？(y/N) " ans
if [[ "$ans" =~ ^[Yy]$ ]]; then
  PLIST="$HOME/Library/LaunchAgents/com.pineapple.douyin-cookies.plist"
  cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.pineapple.douyin-cookies</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$ROOT/scripts/setup-douyin-cookies.sh</string>
    <string>$BROWSER</string>
    <string>--cron</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>8</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>$ROOT/cookies/cron.log</string>
  <key>StandardErrorPath</key>
  <string>$ROOT/cookies/cron.log</string>
</dict>
</plist>
EOF
  launchctl unload "$PLIST" 2>/dev/null || true
  launchctl load "$PLIST"
  echo "✓ 已安装每日 8:00 自动刷新（日志: cookies/cron.log）"
fi

echo ""
echo "✅ 完成。请重新运行 ./start.sh"
