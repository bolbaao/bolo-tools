#!/bin/bash
# 抖音全自动发布依赖：Cookie + Playwright
set -e
cd "$(dirname "$0")/.."

echo "🍍 配置抖音全自动发布…"
chmod +x scripts/setup-douyin-cookies.sh 2>/dev/null || true
./scripts/setup-douyin-cookies.sh "${1:-safari}"

echo "→ 安装 playwright…"
python3 -m pip install --user -U playwright
export PLAYWRIGHT_BROWSERS_PATH="$(pwd)/.local/ms-playwright"
mkdir -p "$PLAYWRIGHT_BROWSERS_PATH"
rm -rf "$PLAYWRIGHT_BROWSERS_PATH/__dirlock"
echo "   浏览器目录: $PLAYWRIGHT_BROWSERS_PATH（请勿并行多次 install）"
python3 -m playwright install chromium
if ! grep -q '^PLAYWRIGHT_BROWSERS_PATH=' .env 2>/dev/null; then
  echo "PLAYWRIGHT_BROWSERS_PATH=.local/ms-playwright" >> .env
fi

if ! grep -q '^SOCIAL_PUBLISH_DOUYIN_AUTO=' .env 2>/dev/null; then
  echo "SOCIAL_PUBLISH_DOUYIN_AUTO=1" >> .env
  echo "✓ 已写入 .env → SOCIAL_PUBLISH_DOUYIN_AUTO=1"
fi

echo ""
echo "✅ 完成。打开 /tools/social-publish → 上传视频 →「仅发布到抖音（全自动）」"
echo "   首次建议在 .env 保持 SOCIAL_PUBLISH_HEADED=1，便于登录或验证码"
