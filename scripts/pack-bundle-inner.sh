#!/bin/bash
# 在 Linux 上生成可运行 tar.gz（由 pack-for-server.sh 调用）
set -euo pipefail
cd "$(dirname "$0")/.."

NAME="${1:?pack name}"
FULL="${2:-0}"
OUT_DIR="dist"
STAGE="$OUT_DIR/.pack-staging-${NAME}"
ARCHIVE="$OUT_DIR/${NAME}-linux-amd64.tar.gz"

rm -rf "$STAGE"
mkdir -p "$STAGE"

echo "→ 组装运行目录…"
rsync -a \
  --exclude='.git' \
  --exclude='.next' \
  --exclude='data' \
  --exclude='dist' \
  --exclude='.env' \
  --exclude='cookies/*.txt' \
  --exclude='.node-portable' \
  ./ "$STAGE/"

# 确保构建产物在包内
if [ ! -d "$STAGE/out" ]; then
  echo "❌ 缺少 out/，请先 npm run build"
  exit 1
fi

cat > "$STAGE/DEPLOY-README.txt" <<'EOF'
春雨集 · Linux 运行包

1. 解压: tar -xzf pineapple-toolbox-*-linux-amd64.tar.gz -C /opt/chunyu
2. 配置: cp .env.example .env && 编辑 API Key、HOST=0.0.0.0、USER_SESSION_SECRET 等
3. 启动: ./start-server.sh
4. 反向代理 Nginx 将 80/443 转到 127.0.0.1:3000

详见 DEPLOY.md
EOF

echo "→ 压缩…"
tar -czf "$ARCHIVE" -C "$OUT_DIR" "$(basename "$STAGE")"
rm -rf "$STAGE"

echo "✓ $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"
