#!/bin/bash
# Linux 云服务器生产启动（监听 0.0.0.0，使用项目内 .local 依赖）
set -euo pipefail
cd "$(dirname "$0")"

ROOT="$(pwd)"
export PATH="$ROOT/.local/bin:$PATH"

# 项目内 Python
if [ -x "$ROOT/.local/python-venv/bin/python3" ]; then
  export PYTHON_BIN="$ROOT/.local/python-venv/bin/python3"
  export PATH="$ROOT/.local/python-venv/bin:$PATH"
fi

# LibreOffice
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
if [ -z "${LIBREOFFICE_PATH:-}" ] && [ -x "$ROOT/.local/libreoffice/program/soffice" ]; then
  export LIBREOFFICE_PATH="$ROOT/.local/libreoffice/program/soffice"
fi

# Playwright 浏览器目录
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$ROOT/.local/ms-playwright}"

# 默认监听（可在 .env 覆盖；宝塔反代建议 HOST=127.0.0.1）
export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-3000}"

if ! command -v node >/dev/null 2>&1; then
  echo "❌ 未找到 Node.js 18+，请安装: https://nodejs.org 或 apt install nodejs"
  exit 1
fi

if command -v lsof >/dev/null 2>&1; then
  OLD_PIDS=$(lsof -ti:"$PORT" 2>/dev/null || true)
  if [ -n "$OLD_PIDS" ]; then
    echo "🔄 关闭端口 $PORT 上的旧进程…"
    echo "$OLD_PIDS" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
fi

if [ ! -d "node_modules" ]; then
  echo "📦 npm ci…"
  npm ci
fi

PDF_WORKER_SRC="node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs"
PDF_WORKER_DST="public/static/pdf.worker.min.mjs"
if [ -f "$PDF_WORKER_SRC" ]; then
  mkdir -p public/static
  cp -f "$PDF_WORKER_SRC" "$PDF_WORKER_DST"
fi

if [ ! -d "out" ]; then
  echo "🔨 npm run build…"
  npm run build
fi

if [ -f ".env" ]; then
  node scripts/ensure-admin-user.mjs 2>/dev/null || true
else
  echo "⚠️  未找到 .env，请: cp .env.example .env"
fi

echo ""
echo "春雨集 · 生产模式"
echo "   http://${HOST}:${PORT}"
echo "   按 Ctrl+C 停止"
echo ""

exec npm run start
