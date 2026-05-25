#!/bin/bash
cd "$(dirname "$0")"

if [ -d ".node-portable/bin" ]; then
  export PATH="$(pwd)/.node-portable/bin:$PATH"
fi

if ! command -v node >/dev/null 2>&1; then
  echo "❌ 未找到 Node.js，请先安装：https://nodejs.org"
  exit 1
fi

# 关闭占用 3000 端口的旧进程（损坏的 next start 会导致 Internal Server Error）
if command -v lsof >/dev/null 2>&1; then
  for _ in 1 2 3; do
    OLD_PIDS=$(lsof -ti:3000 2>/dev/null)
    if [ -z "$OLD_PIDS" ]; then
      break
    fi
    echo "🔄 正在关闭端口 3000 上的旧服务…"
    echo "$OLD_PIDS" | xargs kill -9 2>/dev/null || true
    sleep 2
  done
fi

if [ ! -d "node_modules" ]; then
  echo "📦 正在安装依赖…"
  npm install || exit 1
fi

echo "🔨 正在构建静态网站…"
rm -rf .next out
npm run build || exit 1

echo ""
echo "🍍 菠萝工具箱 已启动"
echo "   浏览器打开: http://127.0.0.1:3000"
echo "   按 Ctrl+C 停止"
echo ""

npm run start
