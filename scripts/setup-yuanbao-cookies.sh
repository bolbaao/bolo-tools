#!/bin/bash
# 微信视频号 · 腾讯元宝 Cookie：导出文件 + 可选每日自动刷新
# 用法: ./scripts/setup-yuanbao-cookies.sh [chrome|safari|...] [--cron] [--install-cron]
set -e
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
CRON_MODE=false
INSTALL_CRON=false
BROWSER_ARG=""

for arg in "$@"; do
  case "$arg" in
    --cron) CRON_MODE=true ;;
    --install-cron) INSTALL_CRON=true ;;
    *)
      if [[ -n "$arg" && "$arg" != --* ]]; then
        BROWSER_ARG="$arg"
      fi
      ;;
  esac
done

export PATH="$ROOT/.local/bin:${HOME}/Library/Python/3.9/bin:${HOME}/Library/Python/3.10/bin:${HOME}/Library/Python/3.11/bin:${HOME}/Library/Python/3.12/bin:$PATH"

pick_browser() {
  if [ -n "$BROWSER_ARG" ]; then
    echo "$BROWSER_ARG"
    return
  fi
  if [ -n "${YUANBAO_COOKIES_FROM_BROWSER:-}" ]; then
    echo "$YUANBAO_COOKIES_FROM_BROWSER"
    return
  fi
  if [ -d "/Applications/Safari.app" ]; then
    echo "safari"
    return
  fi
  echo "safari"
}

BROWSER="$(pick_browser)"
export YUANBAO_COOKIES_FROM_BROWSER="$BROWSER"

if ! $CRON_MODE; then
  echo "🍍 配置微信视频号 Cookie（腾讯元宝 · 浏览器: ${BROWSER}）"
  echo ""
  echo "   请先在 ${BROWSER} 打开并登录: https://yuanbao.tencent.com"
  echo ""
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "❌ 需要 python3"
  exit 1
fi

COOKIE_FILE="$ROOT/cookies/yuanbao.txt"
ENV_FILE="$ROOT/.env"
COOKIE_MODE="file"

if python3 scripts/export-yuanbao-cookies.py >/dev/null 2>&1; then
  $CRON_MODE || echo "✓ 已导出 cookies/yuanbao.txt"
else
  if $CRON_MODE; then
    echo "⚠️  cron: 未能刷新 yuanbao Cookie（请保持 ${BROWSER} 已登录 yuanbao.tencent.com）" >&2
    exit 1
  fi
  echo ""
  echo "⚠️  未能从浏览器自动导出 Cookie"
  echo ""
  echo "手动配置：F12 → Network → yuanbao 请求 → 复制 Cookie"
  echo ""
  if [ -t 0 ]; then
    read -r -p "若已复制 Cookie，可直接粘贴后回车（留空跳过）: " MANUAL_COOKIE
  else
    MANUAL_COOKIE=""
  fi
  if [ -z "$MANUAL_COOKIE" ]; then
    echo "   将依赖解析失败时从 ${BROWSER} 自动重试刷新"
    COOKIE_MODE="browser"
    rm -f "$COOKIE_FILE"
  else
    mkdir -p "$(dirname "$COOKIE_FILE")"
    printf '%s\n' "$MANUAL_COOKIE" > "$COOKIE_FILE"
  fi
fi

touch "$ENV_FILE"
grep -v '^YUANBAO_SPH_COOKIE=' "$ENV_FILE" 2>/dev/null \
  | grep -v '^YUANBAO_SPH_COOKIES=' \
  | grep -v '^YUANBAO_COOKIES_FROM_BROWSER=' \
  | grep -v '^# 微信视频号' > "$ENV_FILE.tmp" || true
mv "$ENV_FILE.tmp" "$ENV_FILE"

{
  echo ""
  echo "# 微信视频号 · 腾讯元宝 Cookie（setup-yuanbao-cookies.sh 自动维护）"
  if [ "$COOKIE_MODE" = "file" ]; then
    echo "YUANBAO_SPH_COOKIES=./cookies/yuanbao.txt"
  fi
  echo "YUANBAO_COOKIES_FROM_BROWSER=${BROWSER}"
} >> "$ENV_FILE"

$CRON_MODE || echo "✓ 已写入 .env"

install_launchd() {
  PLIST="$HOME/Library/LaunchAgents/com.pineapple.yuanbao-cookies.plist"
  mkdir -p "$HOME/Library/LaunchAgents"
  cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.pineapple.yuanbao-cookies</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$ROOT/scripts/setup-yuanbao-cookies.sh</string>
    <string>$BROWSER</string>
    <string>--cron</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>8</integer>
    <key>Minute</key>
    <integer>5</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>$ROOT/cookies/yuanbao-cron.log</string>
  <key>StandardErrorPath</key>
  <string>$ROOT/cookies/yuanbao-cron.log</string>
</dict>
</plist>
EOF
  launchctl unload "$PLIST" 2>/dev/null || true
  launchctl load "$PLIST"
  echo "✓ 已安装每日 8:05 自动刷新（日志: cookies/yuanbao-cron.log）"
}

if $CRON_MODE; then
  exit 0
fi

if $INSTALL_CRON; then
  install_launchd
else
  read -r -p "是否安装「每天 8:05 自动刷新元宝 Cookie」计划任务？(Y/n) " ans
  if [[ -z "$ans" || "$ans" =~ ^[Yy]$ ]]; then
    install_launchd
  fi
fi

echo ""
echo "✅ 完成。解析失败时会自动从 ${BROWSER} 重试刷新 Cookie。"
echo "   请重新运行 ./start.sh 或 npm run dev:api"
