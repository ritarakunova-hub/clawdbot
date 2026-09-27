"""Страница мини-сериала «Бегемот» с тремя сериями (видео встроены).
Запуск: python3 make_page.py <web_dir> out.html   (web_dir: ep1..3.mp4, ep1..3.jpg)
"""
import base64
import html
import sys

web, out = sys.argv[1], sys.argv[2]
b64 = lambda f: base64.b64encode(open(f'{web}/{f}', 'rb').read()).decode()

EPS = [
    (1, 'Дождь', 'Ночной Петербург. Бегемота гонят отовсюду: «Кыш!», «Нельзя!», «Закрыто!». В конце улицы — красный ромб над дверью TAINA.',
     ('Маргарита', 'Заходи, Бегемот. Теперь ты дома.'),
     'В Петербурге дождь, и все двери закрыты. Почти все. #Бегемот'),
    (2, 'Дом для знаний', 'Внутри — киностудия и горы документов. Кот понимает: у документов тоже нет дома. И он видит больше.',
     ('Бегемот', 'У твоих документов тоже нет дома. Они скитаются. Как я вчера.'),
     'Что делать, если у документов нет дома? Бегемот знает. #Бегемот'),
    (3, 'Первый гость', 'Промокший гость неделю ищет ответ. Бегемот находит его за секунду — со ссылкой на документ-источник.',
     ('Бегемот', 'Ответ уже был у вас. Я просто знаю, где искать.'),
     'Ответ уже был у вас. Бегемот просто знает, где искать. Ответ уже есть — TAINA помогает его найти.'),
]

cards = '\n'.join(f'''
    <article class="ep">
      <div class="frame"><video controls playsinline preload="metadata" poster="data:image/jpeg;base64,{b64(f'ep{n}.jpg')}" src="data:video/mp4;base64,{b64(f'ep{n}.mp4')}"></video></div>
      <div class="body">
        <p class="num">Серия {n}</p>
        <h2>{html.escape(name)}</h2>
        <p class="syn">{html.escape(syn)}</p>
        <blockquote><small>{html.escape(q[0])}</small>«{html.escape(q[1])}»</blockquote>
        <div class="cap"><div class="cap-head"><span>Подпись к публикации</span><button class="copy" type="button">Копировать</button></div><p>{html.escape(cap)}</p></div>
      </div>
    </article>''' for n, name, syn, q, cap in EPS)

page = f'''<title>Бегемот</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
  :root{{ color-scheme:dark; --void:#060507; --panel:#100D0D; --line:#2C2320; --ink:#EFE6D6; --soft:#B3A796; --faint:#7C7064; --gold:#C9974A; --goldhi:#F2CF8A; --red:#D0141C; --night:#8FA6BC;
    --serif:"Cormorant Garamond", Georgia, serif; --sans:"IBM Plex Sans", system-ui, sans-serif; }}
  body{{ background:var(--void); color:var(--ink); font:16px/1.65 var(--sans);
    background-image: radial-gradient(ellipse 80% 30% at 50% 0%, rgba(143,166,188,.08), transparent 70%); }}
  .wrap{{ max-width:1000px; margin:0 auto; padding-inline:20px; padding-block:52px 90px; }}
  .eyebrow{{ font:600 12px/1 var(--sans); letter-spacing:.22em; text-transform:uppercase; color:var(--gold); display:flex; gap:12px; align-items:center; margin:0 0 16px; }}
  .dia{{ width:9px; height:15px; background:linear-gradient(135deg,#E3372C 0 50%,#7E0B10 50%); clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%); filter:drop-shadow(0 0 8px var(--red)); }}
  h1,h2{{ font-family:var(--serif); font-weight:500; margin:0; text-wrap:balance; }}
  h1{{ font-size:clamp(56px,10vw,110px); line-height:.95; letter-spacing:.04em; }}
  .lede{{ color:var(--soft); font-size:18px; max-width:60ch; margin:18px 0 0; }}
  .lede em{{ color:var(--goldhi); font-style:italic; font-family:var(--serif); font-size:21px; }}
  .eps{{ display:grid; gap:56px; margin-top:64px; }}
  .ep{{ display:grid; grid-template-columns:minmax(0,300px) minmax(0,1fr); gap:36px; align-items:center; }}
  .frame{{ border:1px solid var(--line); border-radius:22px; padding:8px; background:#000; box-shadow:0 24px 70px rgba(0,0,0,.6), 0 0 0 1px rgba(201,151,74,.12); }}
  .frame video{{ width:100%; max-width:100%; aspect-ratio:9/16; border-radius:16px; display:block; background:#000; }}
  .num{{ font:600 12px/1 var(--sans); letter-spacing:.22em; text-transform:uppercase; color:var(--gold); margin:0 0 8px; }}
  h2{{ font-size:clamp(34px,5vw,52px); line-height:1.05; }}
  .syn{{ color:var(--soft); margin:14px 0 0; max-width:52ch; }}
  blockquote{{ margin:22px 0 0; padding:4px 0 4px 18px; border-left:2px solid var(--gold); font:italic 500 24px/1.35 var(--serif); color:var(--goldhi); }}
  blockquote small{{ display:block; font:600 11px/1.8 var(--sans); font-style:normal; letter-spacing:.2em; text-transform:uppercase; color:var(--faint); }}
  .cap{{ margin-top:22px; border:1px solid var(--line); background:var(--panel); padding:14px 16px; }}
  .cap-head{{ display:flex; justify-content:space-between; align-items:center; gap:12px; font:600 11px/1 var(--sans); letter-spacing:.14em; text-transform:uppercase; color:var(--faint); }}
  .cap p{{ margin:10px 0 0; }}
  .copy{{ font:600 11px/1 var(--sans); letter-spacing:.1em; text-transform:uppercase; color:var(--goldhi); background:transparent; border:1px solid rgba(201,151,74,.45); padding:8px 10px; cursor:pointer; }}
  .copy:hover{{ background:rgba(201,151,74,.12); }}
  .copy:focus-visible{{ outline:2px solid var(--goldhi); outline-offset:2px; }}
  .note{{ margin-top:64px; padding-top:22px; border-top:1px solid var(--line); color:var(--faint); font-size:14px; }}
  @media (max-width:760px){{ .ep{{ grid-template-columns:1fr; }} .frame{{ max-width:340px; }} }}
</style>
<div class="wrap">
  <p class="eyebrow"><span class="dia"></span>TAINA · мини-сериал · глава первая</p>
  <h1>Бегемот</h1>
  <p class="lede">Чёрный пушистый кот скитается по дождливому Петербургу, пока не находит дверь с красным ромбом. У него не было дома — и он даёт дом документам, а потом помогает людям найти ответ. <em>Ответ уже есть. TAINA помогает его найти.</em></p>
  <div class="eps">{cards}</div>
  <p class="note">Три вертикальные серии 9:16 по 37–38 секунд. Всё нарисовано и озвучено кодом. Пример с вопросом гостя в третьей серии демонстрационный.</p>
</div>
<script>
  document.querySelectorAll('.copy').forEach(btn => btn.addEventListener('click', () => {{
    const p = btn.closest('.cap').querySelector('p');
    const ok = () => {{ btn.textContent = 'Скопировано'; setTimeout(() => btn.textContent = 'Копировать', 1600); }};
    const fb = () => {{ const r = document.createRange(); r.selectNodeContents(p); const s = getSelection(); s.removeAllRanges(); s.addRange(r); btn.textContent = 'Выделено — Ctrl+C'; }};
    try {{ navigator.clipboard.writeText(p.textContent).then(ok, fb); }} catch (e) {{ fb(); }}
  }}));
</script>
'''
open(out, 'w', encoding='utf-8').write(page)
print(f'{out}: {len(page) / 1e6:.1f} MB')
