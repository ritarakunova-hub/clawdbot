"""Собирает кампейн-бук премьеры (одна HTML-страница с встроенными видео и постерами).
Запуск: python3 make_book.py <media_dir> out.html
media_dir: trailer.mp4, teaser-1.mp4, teaser-2.mp4, teaser-3.mp4, poster-9x16.jpg, poster-4x5.jpg (веб-версии)
"""
import base64
import html
import sys

media, out = sys.argv[1], sys.argv[2]
b64 = lambda f: base64.b64encode(open(f'{media}/{f}', 'rb').read()).decode()
vid = lambda f: f'data:video/mp4;base64,{b64(f)}'
img = lambda f: f'data:image/jpeg;base64,{b64(f)}'

POSTS = [
    ('День −3 · тизер «Взгляд»', 'Кто-то всегда видит больше.\nЧерез три дня — премьера.'),
    ('День −2 · тизер «Вопрос»', 'Сколько раз за день ваша команда ищет то, что уже знает?\nНапишите в комментариях, какой документ у вас ищут чаще всего.'),
    ('День −1 · тизер «Документы»', 'Найти. Открыть. Снова. Проверить. Переслать.\nЗавтра покажем, как это закончить.'),
    ('День 0 · премьера — ВК и Telegram', 'Сколько раз за день ваша команда ищет то, что уже знает?\n\nРегламент, прайс, договор, переписка. Ответ почти всегда уже есть внутри компании. Он просто лежит не в том документе.\n\nСегодня премьера нового направления — TAINA · AI-автоматизация.\nAI-ассистент, который отвечает сотрудникам и клиентам по документам вашей компании: сразу и со ссылкой на источник. А если ответа в документах нет, честно говорит «не нашли», а не придумывает.\n\nРаботает на российском AI-контуре, без VPN.\n\nОтвет уже есть. TAINA помогает его найти.'),
    ('День 0 · премьера — Instagram', 'Ответ уже есть. Он просто лежит не в том документе.\nTAINA — AI-ассистент, который отвечает по документам компании со ссылкой на источник. Премьера направления.'),
    ('День +1 · как это работает', 'Как ассистент находит ответ, а не придумывает его?\n1. Сотрудник или клиент спрашивает обычными словами.\n2. Система ищет ответ в документах компании, не в интернете.\n3. Ответ приходит сразу, со ссылкой на документ-источник.\n4. Если ответа нет, система честно говорит «не нашли».'),
    ('День +2 · кому подходит', 'Где ассистент по документам окупается, а где нет?\nПодходит: медцентры, образование, сервисные бизнесы, компании с большим объёмом регламентов — там, где вопросы повторяются.\nНе подходит: единичные обращения в день или когда каждый случай уникален. Тогда честно скажем, что автоматизировать рано.'),
    ('День +3 · оффер (сверить цены)', 'С чего начать?\nС бесплатной диагностики на 15 минут: разберём один процесс и честно скажем, стоит ли его автоматизировать и стоит ли делать это сейчас.\nПервый проект — от 70 000 ₽.\nЗаявка — через форму на сайте.'),
]
CAL = [
    ('−3', 'Тизер «Взгляд» + подпись', 'Instagram · ВК · Telegram'),
    ('−2', 'Тизер «Вопрос» + вопрос в комментарии: какой документ ищут чаще всего', 'Instagram · ВК'),
    ('−1', 'Тизер «Документы» + «Завтра премьера»', 'все площадки'),
    ('0', 'Премьера: трейлер, манифест, постер. Закреп', 'все + YouTube Shorts'),
    ('+1', 'Карусель «Как это работает»: вопрос → поиск по документам → ответ со ссылкой → «не нашли»', 'Instagram · ВК · Telegram'),
    ('+2', 'Пост «Кому подходит и кому нет» — честный фильтр', 'ВК · Telegram'),
    ('+3', 'Оффер: бесплатная диагностика 15 минут, запись через форму', 'все площадки'),
]

posts_html = '\n'.join(f'''<article class="post"><header><h3>{html.escape(t)}</h3><button class="copy" type="button">Копировать</button></header><pre>{html.escape(b)}</pre></article>''' for t, b in POSTS)
cal_html = '\n'.join(f'<tr><td class="day">{d}</td><td>{html.escape(w)}</td><td class="where">{html.escape(p)}</td></tr>' for d, w, p in CAL)

page = f'''<title>Премьера TAINA AI</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
  :root{{ color-scheme:dark; --void:#070506; --panel:#110D0D; --line:#2E2422; --ink:#EFE6D6; --soft:#B3A796; --faint:#7C7064;
    --gold:#C9974A; --goldhi:#F2CF8A; --red:#D0141C; --velvet:#5E0A10;
    --serif:"Cormorant Garamond", Georgia, serif; --sans:"IBM Plex Sans", system-ui, sans-serif; }}
  body{{ background:var(--void); color:var(--ink); font:16px/1.65 var(--sans); }}
  .wrap{{ max-width:1080px; margin:0 auto; padding-inline:20px; padding-block:48px 90px; }}
  .eyebrow{{ font:600 12px/1 var(--sans); letter-spacing:.22em; text-transform:uppercase; color:var(--gold); display:flex; align-items:center; gap:12px; margin:0 0 18px; }}
  .dia{{ width:9px; height:15px; background:linear-gradient(135deg,#E3372C 0 50%,#7E0B10 50%); clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%); filter:drop-shadow(0 0 8px var(--red)); flex:none; }}
  h1,h2,h3{{ font-family:var(--serif); font-weight:500; margin:0; text-wrap:balance; }}
  h1{{ font-size:clamp(44px,8vw,86px); line-height:.98; letter-spacing:-.01em; }}
  h1 em{{ color:var(--goldhi); }}
  h2{{ font-size:clamp(30px,4.4vw,46px); line-height:1.08; margin-bottom:18px; }}
  p{{ margin:0; }}
  .lede{{ color:var(--soft); font-size:18px; max-width:58ch; margin-top:20px; }}
  section{{ margin-top:88px; }}
  .hero{{ display:grid; grid-template-columns:minmax(0,1fr) minmax(0,360px); gap:48px; align-items:center; }}
  .phone{{ border:1px solid var(--line); border-radius:28px; padding:10px; background:#000; box-shadow:0 30px 80px rgba(208,20,28,.18), 0 0 0 1px rgba(201,151,74,.15); }}
  .phone video{{ width:100%; max-width:100%; aspect-ratio:9/16; border-radius:20px; display:block; background:#000; }}
  .lines{{ display:grid; gap:14px; margin-top:28px; }}
  .line{{ border-left:2px solid var(--gold); padding:4px 0 4px 16px; }}
  .line small{{ display:block; font:600 11px/1.6 var(--sans); letter-spacing:.18em; text-transform:uppercase; color:var(--faint); }}
  .line b{{ font:500 26px/1.25 var(--serif); font-style:italic; color:var(--goldhi); }}
  .idea{{ display:grid; grid-template-columns:1fr 1fr; gap:40px; }}
  .idea p + p{{ margin-top:14px; }}
  .idea .soft{{ color:var(--soft); }}
  .bridge{{ display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:16px; align-items:center; margin-top:28px; padding:22px; border:1px solid var(--line); background:var(--panel); }}
  .bridge div small{{ display:block; font:600 11px/1.6 var(--sans); letter-spacing:.18em; text-transform:uppercase; color:var(--gold); }}
  .bridge div span{{ font:500 21px/1.3 var(--serif); }}
  .manifest{{ position:relative; padding:56px clamp(20px,6vw,72px); background:radial-gradient(ellipse at 50% 0%, rgba(208,20,28,.16), transparent 60%), var(--panel); border:1px solid var(--line); text-align:center; }}
  .manifest p{{ font:500 clamp(22px,3vw,30px)/1.45 var(--serif); }}
  .manifest p em{{ color:var(--goldhi); }}
  .manifest .sign{{ margin-top:26px; font:600 12px/1 var(--sans); letter-spacing:.3em; color:var(--gold); }}
  .teasers{{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:18px; }}
  .teasers figure{{ margin:0; }}
  .teasers video{{ width:100%; max-width:100%; aspect-ratio:9/16; display:block; border:1px solid var(--line); background:#000; }}
  figcaption{{ margin-top:10px; font-size:14px; color:var(--soft); }}
  figcaption b{{ color:var(--ink); font-weight:600; display:block; }}
  .posters{{ display:grid; grid-template-columns:minmax(0,9fr) minmax(0,12fr); gap:18px; align-items:start; }}
  .posters img{{ width:100%; display:block; border:1px solid var(--line); }}
  .table-wrap{{ overflow-x:auto; }}
  table{{ width:100%; border-collapse:collapse; font-size:15px; min-width:560px; }}
  td{{ padding:14px 12px; border-top:1px solid var(--line); vertical-align:top; }}
  td.day{{ font:600 22px/1 var(--serif); color:var(--goldhi); width:56px; font-variant-numeric:tabular-nums; }}
  td.where{{ color:var(--faint); font-size:13px; width:190px; }}
  tr.zero td{{ background:linear-gradient(90deg, rgba(208,20,28,.18), transparent); }}
  .posts{{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }}
  .post{{ border:1px solid var(--line); background:var(--panel); padding:18px 18px 20px; }}
  .post header{{ display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:10px; }}
  .post h3{{ font:600 13px/1.4 var(--sans); letter-spacing:.06em; color:var(--gold); }}
  .post pre{{ margin:0; white-space:pre-wrap; font:400 15px/1.6 var(--sans); color:var(--ink); }}
  .copy{{ font:600 11px/1 var(--sans); letter-spacing:.1em; text-transform:uppercase; color:var(--goldhi); background:transparent; border:1px solid rgba(201,151,74,.45); padding:8px 10px; cursor:pointer; flex:none; }}
  .copy:hover{{ background:rgba(201,151,74,.12); }}
  .copy:focus-visible{{ outline:2px solid var(--goldhi); outline-offset:2px; }}
  ol.decide{{ margin:0; padding-left:22px; display:grid; gap:10px; color:var(--soft); }}
  ol.decide b{{ color:var(--ink); font-weight:600; }}
  .rules{{ font-size:14px; color:var(--faint); margin-top:14px; }}
  @media (max-width:820px){{
    .hero, .idea, .posters{{ grid-template-columns:1fr; }}
    .teasers{{ grid-template-columns:1fr; max-width:360px; }}
    .posts{{ grid-template-columns:1fr; }}
    .bridge{{ grid-template-columns:1fr; }}
    .phone{{ max-width:360px; }}
  }}
</style>
<div class="wrap">

  <section class="hero" style="margin-top:0">
    <div>
      <p class="eyebrow"><span class="dia"></span>Кампания запуска · TAINA · AI-автоматизация</p>
      <h1>Ответ уже есть. <em>TAINA помогает его найти.</em></h1>
      <p class="lede">Премьера нового направления TAINA: AI-автоматизация. Первый продукт — ассистент, который отвечает по документам компании со ссылкой на источник. Здесь всё для запуска: трейлер, три тизера, постер, идея, манифест, календарь и готовые тексты.</p>
      <div class="lines">
        <div class="line"><small>Главная фраза</small><b>«Ответ уже есть. TAINA помогает его найти.»</b></div>
        <div class="line"><small>Вопрос кампании</small><b>«Сколько раз за день ваша команда ищет то, что уже знает?»</b></div>
      </div>
    </div>
    <div class="phone"><video controls playsinline preload="metadata" poster="{img('poster-9x16.jpg')}" src="{vid('trailer.mp4')}"></video></div>
  </section>

  <section>
    <p class="eyebrow">Большая идея</p>
    <div class="idea">
      <h2>Компания уже знает ответ. Команда тратит часы, чтобы его найти.</h2>
      <div>
        <p>Регламенты, договоры, прайсы, переписки. Информации достаточно, но она не система: каждый раз её нужно найти, открыть, проверить и переслать.</p>
        <p class="soft">Кампания не продаёт «искусственный интеллект». Она показывает знакомую боль и момент, когда ответ появляется сразу, со ссылкой на документ. Трейлер: вопрос → лента документов (найти, открыть, снова, проверить, переслать) → «Ответ уже есть» → занавес, ромб и ответ ассистента с источником.</p>
      </div>
    </div>
    <div class="bridge steps">
      <div><small>1 · Вопрос</small><span>обычными словами, без спецзапросов</span></div>
      <div><small>2 · Поиск</small><span>в документах компании, не в интернете</span></div>
      <div><small>3 · Ответ</small><span>сразу, со ссылкой на источник</span></div>
      <div><small>4 · Честность</small><span>нет в документах — «не нашли», без выдумок</span></div>
    </div>
  </section>

  <section>
    <div class="manifest">
      <p>Сколько раз за день ваша команда ищет то, что уже знает?<br>Регламент. Прайс. Договор. Переписка.<br>Найти, открыть, проверить, <em>переслать — и снова.</em></p>
      <p style="margin-top:22px">Ответ почти всегда уже есть внутри компании.<br>Он просто лежит не в том документе.<br>TAINA делает его доступным: сразу и со ссылкой на источник.</p>
      <p class="sign">ОТВЕТ УЖЕ ЕСТЬ · TAINA ПОМОГАЕТ ЕГО НАЙТИ</p>
    </div>
  </section>

  <section>
    <p class="eyebrow">Прогрев · три тизера по 5–8 секунд</p>
    <h2>Три дня до премьеры</h2>
    <div class="teasers">
      <figure><video controls playsinline preload="metadata" src="{vid('teaser-1.mp4')}"></video><figcaption><b>−3 · «Взгляд»</b>Бегемот на стопке документов. Кто-то всегда видит больше.</figcaption></figure>
      <figure><video controls playsinline preload="metadata" src="{vid('teaser-2.mp4')}"></video><figcaption><b>−2 · «Вопрос»</b>Сколько раз за день ваша команда ищет то, что уже знает?</figcaption></figure>
      <figure><video controls playsinline preload="metadata" src="{vid('teaser-3.mp4')}"></video><figcaption><b>−1 · «Документы»</b>Найти. Открыть. Снова. Проверить. Переслать.</figcaption></figure>
    </div>
  </section>

  <section>
    <p class="eyebrow">Ключевой визуал</p>
    <h2>Постер премьеры</h2>
    <div class="posters">
      <figure style="margin:0"><img src="{img('poster-9x16.jpg')}" alt="Постер 9:16: занавес, арка с красным ромбом, TAINA AI-автоматизация, Бегемот на стопке документов"><figcaption><b>9:16</b>Сторис, обложка клипа, событие</figcaption></figure>
      <figure style="margin:0"><img src="{img('poster-4x5.jpg')}" alt="Постер 4:5 для ленты"><figcaption><b>4:5</b>Пост в ленте Instagram и ВК</figcaption></figure>
    </div>
  </section>

  <section>
    <p class="eyebrow">Механика</p>
    <h2>Запуск за 7 дней</h2>
    <div class="table-wrap"><table>
      {cal_html.replace('<tr><td class="day">0<', '<tr class="zero"><td class="day">0<')}
    </table></div>
  </section>

  <section>
    <p class="eyebrow">Тексты</p>
    <h2>Готовые публикации</h2>
    <div class="posts">{posts_html}</div>
    <p class="rules">Тон: умно, загадочно, уверенно; сначала вопрос, потом объяснение. Без «уникальный», «креативный», «эксклюзивный».</p>
  </section>

  <section>
    <p class="eyebrow">Перед запуском</p>
    <h2>Что решить</h2>
    <ol class="decide">
      <li><b>Дата премьеры.</b> От неё считаются дни −3…+3.</li>
      <li><b>Первый шаг для клиента.</b> На сайте — бесплатная диагностика 15 минут, в прайсе — разбор за 15 000 ₽. В оффере стоит бесплатная диагностика и «первый проект от 70 000 ₽». Подтвердите.</li>
      <li><b>Честность в материалах.</b> Клиентских кейсов пока нет, есть демо на медицинских документах. В текстах это соблюдено; вопрос в трейлере — демонстрационный.</li>
    </ol>
  </section>
</div>
<script>
  document.querySelectorAll('.copy').forEach(btn => btn.addEventListener('click', () => {{
    const pre = btn.closest('.post').querySelector('pre');
    const ok = () => {{ btn.textContent = 'Скопировано'; setTimeout(() => btn.textContent = 'Копировать', 1600); }};
    const fb = () => {{ const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); btn.textContent = 'Выделено — Ctrl+C'; }};
    try {{ navigator.clipboard.writeText(pre.textContent).then(ok, fb); }} catch (e) {{ fb(); }}
  }}));
</script>
'''
open(out, 'w', encoding='utf-8').write(page)
print(f'{out}: {len(page) / 1e6:.1f} MB')
