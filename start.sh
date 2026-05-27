#!/bin/bash
cd "$(dirname "$0")"

ROOT="$(pwd)"
if [ -d ".node-portable/bin" ]; then
  export PATH="$ROOT/.node-portable/bin:$PATH"
fi
# 本机工具：yt-dlp、ffmpeg 等
export PATH="$ROOT/.local/bin:$PATH"

# LibreOffice（项目内 .local，无需系统安装）
LOCAL_SOFFICE="$ROOT/.local/LibreOffice.app/Contents/MacOS/soffice"
if [ -f ".env" ]; then
  LO_FROM_ENV="$(grep -E '^[[:space:]]*LIBREOFFICE_PATH=' .env | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs)"
  if [ -n "$LO_FROM_ENV" ]; then
    if [ "${LO_FROM_ENV#/}" = "$LO_FROM_ENV" ]; then
      export LIBREOFFICE_PATH="$ROOT/$LO_FROM_ENV"
    else
      export LIBREOFFICE_PATH="$LO_FROM_ENV"
    fi
  fi
fi
if [ -z "${LIBREOFFICE_PATH:-}" ] && [ -x "$LOCAL_SOFFICE" ]; then
  export LIBREOFFICE_PATH="$LOCAL_SOFFICE"
fi
export PATH="${HOME}/Library/Python/3.9/bin:${HOME}/Library/Python/3.10/bin:${HOME}/Library/Python/3.11/bin:${HOME}/Library/Python/3.12/bin:$PATH"

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

# 启动前尝试刷新抖音 Cookie（已配置 cookies/douyin.txt 或 setup 脚本时）
if [ -f "cookies/douyin.txt" ] && command -v python3 >/dev/null 2>&1; then
  if python3 -c "import browser_cookie3" 2>/dev/null; then
    python3 scripts/export-douyin-cookies.py 2>/dev/null && echo "✓ 已刷新抖音 Cookie" || true
  fi
elif [ ! -f "cookies/douyin.txt" ]; then
  echo "💡 抖音解析建议运行一次: ./scripts/setup-douyin-cookies.sh"
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
