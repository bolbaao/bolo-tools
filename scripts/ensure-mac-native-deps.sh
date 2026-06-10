#!/bin/bash
# 确保 npm 可选原生模块为当前 Mac 架构（darwin-arm64 / darwin-x64）
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "$(uname -s)" != "Darwin" ]; then
  exit 0
fi

ARCH="$(uname -m)"
case "$ARCH" in
  arm64)
    NPM_CPU=arm64
    SUFFIX=darwin-arm64
    ;;
  x86_64)
    NPM_CPU=x64
    SUFFIX=darwin-x64
    ;;
  *)
    echo "❌ 不支持的 Mac CPU 架构: $ARCH"
    exit 1
    ;;
esac

export npm_config_os=darwin
export npm_config_cpu="$NPM_CPU"

if [ ! -d node_modules ]; then
  echo "→ 安装 npm 依赖（Mac ${SUFFIX}）…"
  npm install
fi

need=()
for pkg in \
  "lightningcss-${SUFFIX}" \
  "@tailwindcss/oxide-${SUFFIX}" \
  "@next/swc-${SUFFIX}" \
  "@img/sharp-${SUFFIX}"; do
  if [ ! -d "node_modules/${pkg}" ]; then
    need+=("$pkg")
  fi
done

if [ ${#need[@]} -gt 0 ]; then
  echo "→ 补装 Mac 原生模块: ${need[*]}"
  npm install --no-save "${need[@]}"
fi

node -e "
  require('lightningcss-${SUFFIX}');
  require('lightningcss');
  console.log('✓ Mac 原生模块就绪 (${SUFFIX})');
"
