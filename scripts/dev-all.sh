#!/bin/bash
# 同时启动 API（3001）与 Next 开发服（3002）
set -euo pipefail
cd "$(dirname "$0")/.."

ROOT="$(pwd)"
if [ -d ".node-portable/bin" ]; then
  export PATH="$ROOT/.node-portable/bin:$PATH"
fi

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

cleanup() {
  if [ -n "${API_PID:-}" ]; then
    kill "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if ! command -v node >/dev/null 2>&1; then
  echo "❌ 未找到 Node.js"
  exit 1
fi

if lsof -ti:3001 >/dev/null 2>&1; then
  echo "⚠️  端口 3001 已被占用，请先停止旧 API（./stop.sh 或结束占用进程）"
  exit 1
fi

echo "🔌 启动 API 开发服务 (3001)…"
npm run dev:api &
API_PID=$!

for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf "http://127.0.0.1:3001/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

if ! curl -sf "http://127.0.0.1:3001/api/health" >/dev/null 2>&1; then
  echo "❌ API 未在 3001 就绪，请检查 npm run dev:api 日志"
  exit 1
fi

echo "✓ API 就绪"
echo "🌐 启动前端开发服 (3002)…"
echo "   浏览器打开: http://127.0.0.1:3002"
echo ""

npm run dev
