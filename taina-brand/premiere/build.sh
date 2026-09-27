#!/usr/bin/env bash
# Сборка материалов премьеры TAINA · AI-автоматизация:
#   out/taina-ai-trailer.mp4        трейлер 30 с, 1080×1920
#   out/taina-ai-teaser-{1,2,3}.mp4  тизеры 5–8 с (фрагмент трейлера + карточка «Премьера · скоро»)
#   out/poster-9x16.jpg, out/poster-4x5.jpg
#   out/campaign-book.html              кампейн-бук со встроенными материалами
# Нужно: node + глобальный playwright, python3 + numpy + imageio-ffmpeg
set -euo pipefail
cd "$(dirname "$0")"
TMP=${TMP_DIR:-$(mktemp -d)}
FF=$(python3 -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())")
mkdir -p out "$TMP/web"

[ -f "$TMP/frames/0959.jpg" ] || node render.mjs frames "$TMP/frames" 30 0 32
[ -f "$TMP/poster/t40.jpg" ] || node render.mjs stills "$TMP/poster" 40
python3 sound.py "$TMP/trailer.wav" "$TMP/sting.wav"

ENC=(-c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 192k)
# трейлер
"$FF" -y -loglevel error -framerate 30 -start_number 0 -i "$TMP/frames/%04d.jpg" -i "$TMP/trailer.wav" \
  -frames:v 900 "${ENC[@]}" -shortest out/taina-ai-trailer.mp4
# карточка тизера (кадры 900–959) со «ударом»
"$FF" -y -loglevel error -framerate 30 -start_number 900 -i "$TMP/frames/%04d.jpg" -i "$TMP/sting.wav" \
  -frames:v 60 "${ENC[@]}" -shortest "$TMP/endcard.mp4"
# тизеры: фрагмент трейлера (с затуханием звука) + карточка
teaser() { # $1 номер, $2 начало, $3 длительность
  "$FF" -y -loglevel error -ss "$2" -t "$3" -i out/taina-ai-trailer.mp4 \
    -af "afade=t=in:d=0.15,afade=t=out:st=$(python3 -c "print($3-0.35)"):d=0.35" -vf "fade=t=in:d=0.2" "${ENC[@]}" "$TMP/part$1.mp4"
  "$FF" -y -loglevel error -i "$TMP/part$1.mp4" -i "$TMP/endcard.mp4" \
    -filter_complex "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]" -map "[v]" -map "[a]" "${ENC[@]}" "out/taina-ai-teaser-$1.mp4"
}
teaser 1 0.2 3.3
teaser 2 3.6 4.7
teaser 3 8.6 6.4
# постеры
cp "$TMP/poster/t40.jpg" out/poster-9x16.jpg
"$FF" -y -loglevel error -i out/poster-9x16.jpg -vf "crop=1080:1350:0:260" -q:v 2 out/poster-4x5.jpg
# веб-версии для кампейн-бука
for f in taina-ai-trailer taina-ai-teaser-1 taina-ai-teaser-2 taina-ai-teaser-3; do
  "$FF" -y -loglevel error -i "out/$f.mp4" -vf scale=720:-2 -c:v libx264 -preset slow -crf 25 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 128k "$TMP/web/${f#taina-ai-}.mp4"
done
"$FF" -y -loglevel error -i out/poster-9x16.jpg -vf scale=720:-2 -q:v 4 "$TMP/web/poster-9x16.jpg"
"$FF" -y -loglevel error -i out/poster-4x5.jpg -vf scale=720:-2 -q:v 4 "$TMP/web/poster-4x5.jpg"
python3 make_book.py "$TMP/web" out/campaign-book.html
ls -la out
