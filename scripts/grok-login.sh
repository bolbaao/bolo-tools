#!/bin/bash
# Grok CLI 登录（浏览器或设备码）
set -e
export PATH="${HOME}/.grok/bin:${PATH}"

if ! command -v grok >/dev/null 2>&1; then
  echo "未找到 grok，请先运行：./scripts/install-grok-cli.sh"
  exit 1
fi

echo "🍍 正在打开 Grok 登录…"
if [ -t 1 ]; then
  grok login
else
  echo "无交互终端，使用设备码登录："
  grok login --device-auth
fi

if [ -f "$HOME/.grok/auth.json" ]; then
  echo "✓ 登录成功，可重启 ./start.sh 后使用闲聊对话"
else
  echo "⚠ 未检测到 ~/.grok/auth.json，请确认登录完成"
fi
