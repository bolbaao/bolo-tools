#!/usr/bin/env bash
# 下载并压缩各工具演示视频到 public/demos/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEMOS="$ROOT/public/demos"
FFMPEG="$(node -e "console.log(require('@ffmpeg-installer/ffmpeg').path)" 2>/dev/null || true)"

if [[ -z "$FFMPEG" || ! -x "$FFMPEG" ]]; then
  echo "需要 @ffmpeg-installer/ffmpeg，请先 npm install"
  exit 1
fi

mkdir -p "$DEMOS"

download_one() {
  local id="$1"
  local url="$2"
  local out="$DEMOS/${id}.mp4"
  echo "→ $id"
  "$FFMPEG" -y -hide_banner -loglevel error \
    -i "$url" \
    -t 12 \
    -vf "scale='min(720,iw)':-2" \
    -an \
    -c:v libx264 \
    -crf 28 \
    -preset fast \
    -movflags +faststart \
    "$out"
  ls -lh "$out"
}

# shellcheck disable=SC2034
declare -a ITEMS=(
  "music-convert|https://cdn.coverr.co/videos/coverr-man-playing-the-piano-6284/1080p.mp4"
  "video-extract|https://cdn.coverr.co/videos/coverr-connected-on-the-go-smartphone-in-use/1080p.mp4"
  "image-studio|https://cdn.coverr.co/videos/coverr-taking-photos-of-orchids-3595/1080p.mp4"
  "ai-chat|https://cdn.coverr.co/videos/coverr-woman-texting-and-smiling-3838/1080p.mp4"
  "hot-trends|https://cdn.coverr.co/videos/coverr-scrolling-through-coronavirus-news-6170/1080p.mp4"
  "media-search|https://cdn.coverr.co/videos/coverr-film-director-s-pov-7972/1080p.mp4"
  "spider-builder|https://cdn.coverr.co/videos/coverr-developing-coding-sequences-3909/1080p.mp4"
  "assets|https://cdn.coverr.co/videos/coverr-timelapse-working-from-home-3951/1080p.mp4"
)

for entry in "${ITEMS[@]}"; do
  id="${entry%%|*}"
  url="${entry#*|}"
  download_one "$id" "$url"
done

echo "完成：$DEMOS"
