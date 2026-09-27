#!/usr/bin/env bash
# Сборка ролика: кадры (Playwright + Chromium) + звук (numpy) → taina-film.mp4
# Нужно: node + глобальный playwright, python3 + numpy + imageio-ffmpeg
#   npm i -g playwright && pip install numpy imageio-ffmpeg
set -euo pipefail
cd "$(dirname "$0")"
TMP=$(mktemp -d)
FF=$(python3 -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())")

node render.mjs frames "$TMP/frames" 30
python3 sound.py "$TMP/sound.wav"
"$FF" -y -loglevel error -framerate 30 -i "$TMP/frames/%04d.jpg" -i "$TMP/sound.wav" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -b:a 192k -shortest taina-film.mp4
rm -rf "$TMP"
echo "Готово: $(pwd)/taina-film.mp4"
