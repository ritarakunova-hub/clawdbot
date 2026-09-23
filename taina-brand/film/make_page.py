"""Собирает страницу-плеер с встроенным MP4 (data URI) для публикации как Artifact.
Запуск: python3 make_page.py taina-film.mp4 out.html
"""
import base64
import sys

src, out = sys.argv[1], sys.argv[2]
b64 = base64.b64encode(open(src, 'rb').read()).decode()

page = f"""<title>Ролик TAINA</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;1,500&family=IBM+Plex+Sans:wght@400;500&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
  :root{{ color-scheme:dark; --void:#08080A; --line:#2C2A30; --ink:#ECE6DA; --soft:#A9A197; --faint:#6F6961; --gold:#D7A24C; --dia:#C4302B; }}
  body{{ background:var(--void); color:var(--ink); font:16px/1.6 "IBM Plex Sans", system-ui, sans-serif; }}
  .wrap{{ max-width:1120px; margin:0 auto; padding-block:40px 64px; padding-inline:20px; display:grid; gap:22px; }}
  .eyebrow{{ font:500 12px/1 "IBM Plex Mono", monospace; letter-spacing:.14em; text-transform:uppercase; color:var(--faint); display:flex; gap:10px; align-items:center; margin:0; }}
  .dia{{ width:9px; height:9px; background:var(--dia); transform:rotate(45deg); box-shadow:0 0 12px var(--dia); }}
  h1{{ font:500 clamp(34px,5.4vw,56px)/1.05 "Cormorant Garamond", Georgia, serif; margin:0; text-wrap:balance; }}
  h1 em{{ color:var(--gold); }}
  video{{ width:100%; max-width:100%; aspect-ratio:16/9; background:#000; border:1px solid var(--line); display:block; }}
  .meta{{ display:flex; flex-wrap:wrap; gap:8px 28px; font:500 13px/1.5 "IBM Plex Mono", monospace; color:var(--soft); }}
  .meta b{{ color:var(--faint); font-weight:500; margin-right:6px; }}
  p.note{{ color:var(--soft); max-width:70ch; margin:0; }}
</style>
<div class="wrap">
  <p class="eyebrow"><span class="dia"></span>TAINA · имиджевый ролик · 0:30</p>
  <h1>Ответ уже есть. <em>TAINA помогает его найти.</em></h1>
  <video controls playsinline preload="auto" src="data:video/mp4;base64,{b64}"></video>
  <div class="meta">
    <span><b>0–3</b>точка</span><span><b>3–8</b>архив</span><span><b>8–15</b>лабиринт</span>
    <span><b>15–18</b>тишина</span><span><b>18–25</b>порядок</span><span><b>25–30</b>покой</span>
  </div>
  <p class="note">Анимация собрана кодом по раскадровке: моушн-графика в фирменной палитре, звук синтезирован. Это рабочая версия, чтобы проверить темп, текст и драматургию. Кинематографичную версию с фактурой бумаги и светом можно сделать в Kling, Runway или Veo по промптам из раскадровки.</p>
</div>
"""
open(out, 'w', encoding='utf-8').write(page)
print(f'{out}: {len(page) / 1e6:.1f} MB')
