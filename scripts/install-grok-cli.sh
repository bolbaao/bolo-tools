#!/bin/bash
# 安装官方 Grok CLI（https://x.ai/cli）
set -e
cd "$(dirname "$0")/.."

echo "🍍 安装 Grok CLI（xAI 官方）…"
if ! curl -fsSL --connect-timeout 15 --max-time 120 "https://x.ai/cli/install.sh" | bash; then
  echo "→ x.ai 不可达，改用 GCS 镜像安装…"
  CHANNEL="${GROK_CHANNEL:-stable}"
  BASE="https://storage.googleapis.com/grok-build-public-artifacts/cli"
  VERSION="${1:-$(curl -fsSL --max-time 30 "${BASE}/${CHANNEL}")}"
  case "$(uname -s)" in Darwin) os=macos ;; Linux) os=linux ;; *) echo "不支持的操作系统" >&2; exit 1 ;; esac
  case "$(uname -m)" in x86_64|amd64) arch=x86_64 ;; arm64|aarch64) arch=aarch64 ;; *) echo "不支持的架构" >&2; exit 1 ;; esac
  platform="${os}-${arch}"
  mkdir -p "$HOME/.grok/downloads" "$HOME/.grok/bin"
  dest="$HOME/.grok/downloads/grok-${platform}"
  echo "  下载 grok ${VERSION} (${platform})…"
  curl -fsSL --max-time 900 -C - -o "$dest" "${BASE}/grok-${VERSION}-${platform}"
  chmod +x "$dest"
  ln -sf "../downloads/grok-${platform}" "$HOME/.grok/bin/grok"
  ln -sf "../downloads/grok-${platform}" "$HOME/.grok/bin/agent"
fi

export PATH="${HOME}/.grok/bin:${PATH}"

if command -v grok >/dev/null 2>&1; then
  echo ""
  echo "✓ grok 已安装: $(command -v grok)"
  grok --version 2>/dev/null || true
else
  echo "⚠ 安装完成但未在 PATH 中找到 grok，请执行："
  echo "   export PATH=\"\$HOME/.grok/bin:\$PATH\""
fi

echo ""
echo "下一步：在终端登录（浏览器授权）"
echo "   grok login"
echo ""
echo "然后在 .env 中启用 CLI 模式："
echo "   GROK_USE_CLI=1"
