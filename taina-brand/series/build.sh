#!/usr/bin/env bash
# Сборка мини-сериала «Бегемот»: out/begemot-ep{1,2,3}.mp4 (1080×1920) и страница out/series.html
# Нужно: node + глобальный playwright, python3 + numpy + imageio-ffmpeg
set -euo pipefail
cd "$(dirname "$0")"
TMP=${TMP_DIR:-$(mktemp -d)}
FF=$(python3 -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())")
mkdir -p out "$TMP/web"
for e in 1 2 3; do
  [ -n "$(ls "$TMP/ep$e" 2>/dev/null)" ] || EP=$e node render.mjs frames "$TMP/ep$e" 30
  python3 sound.py "$e" "$TMP/ep$e.wav"
  "$FF" -y -loglevel error -framerate 30 -i "$TMP/ep$e/%04d.jpg" -i "$TMP/ep$e.wav" \
    -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 192k -shortest "out/begemot-ep$e.mp4"
  "$FF" -y -loglevel error -i "out/begemot-ep$e.mp4" -vf scale=720:-2 -c:v libx264 -preset slow -crf 25 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 128k "$TMP/web/ep$e.mp4"
  "$FF" -y -loglevel error -ss 2.5 -i "out/begemot-ep$e.mp4" -frames:v 1 -vf scale=720:-2 -q:v 4 "$TMP/web/ep$e.jpg"
done
python3 make_page.py "$TMP/web" out/series.html
ls -la out
