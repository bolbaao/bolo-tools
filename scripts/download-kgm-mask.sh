#!/usr/bin/env bash
# 下载酷狗 KGM/VPR 解密所需的 kgm.mask（来自 Unlock Music 项目）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/static/kgm.mask"
mkdir -p "$(dirname "$OUT")"

URLS=(
  "https://cdn.jsdelivr.net/gh/unlock-music/unlock-music@1.10.3/public/static/kgm.mask"
  "https://raw.githubusercontent.com/rainlotus97/unlock-music/master/public/static/kgm.mask"
  "https://raw.githubusercontent.com/emp3826/unlock-music/master/public/static/kgm.mask"
)

for url in "${URLS[@]}"; do
  echo "尝试: $url"
  if curl -fsSL --connect-timeout 15 -o "$OUT" "$url"; then
    size=$(wc -c < "$OUT" | tr -d ' ')
    if [ "$size" -gt 4096 ]; then
      echo "✓ 已保存 ($size bytes) → $OUT"
      exit 0
    fi
    rm -f "$OUT"
  fi
done

echo "下载失败。请从 Unlock Music 发行包手动复制 public/static/kgm.mask 到:"
echo "  $OUT"
exit 1
