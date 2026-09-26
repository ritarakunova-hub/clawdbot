/*
  TAINA STUDIO — трейлер-премьера направления «Имиджевые фильмы». 30 с, 1080×1920.
  0–3.6    Заставка  — луч кинопроектора, Бегемот на кинобобинах. «TAINA STUDIO представляет»
  3.6–8.4  Вопрос    — «Что остаётся от бренда, когда реклама закончилась?»
  8.4–15   Плёнка    — лента кадров ускоряется: Свет. Ритм. Тишина. Характер. Смысл.
  15–19    Ответ     — «Ощущение. Его невозможно объяснить. Его можно снять.»
  19–24.5  Занавес   — красный бархат раскрывается: ромб в арке, TAINA STUDIO, «Имиджевые фильмы»
  24.5–30  Премьера  — «Премьера направления. Ваша история — следующая.»
  30–32    (только для тизеров) финальная карточка «Премьера · скоро»
  40       (только для постера) ключевой визуал
*/

/* ---------- новые элементы ---------- */
// Металлическое золото для надписей
const metal = document.createElement('canvas'); metal.width = W; metal.height = 420;
function goldWord(str, y, size, ls, a, shine) {
  if (a <= 0) return;
  const m = metal.getContext('2d');
  m.setTransform(1, 0, 0, 1, 0, 0); m.globalCompositeOperation = 'source-over'; m.clearRect(0, 0, W, 420);
  m.font = `600 ${size}px ${SERIF}`; m.letterSpacing = ls + 'px'; m.textAlign = 'center'; m.textBaseline = 'middle';
  const gr = m.createLinearGradient(0, 210 - size * .45, 0, 210 + size * .45);
  gr.addColorStop(0, '#5E3F17'); gr.addColorStop(.28, '#E8C07A'); gr.addColorStop(.5, '#8C5E26'); gr.addColorStop(.72, '#F5D99A'); gr.addColorStop(1, '#6A4A1E');
  m.fillStyle = gr; m.fillText(str, W / 2 + ls / 2, 210);
  m.globalCompositeOperation = 'source-atop';
  m.globalAlpha = .22; m.drawImage(grains[1], 0, 0, W, 420); m.globalAlpha = 1;
  const sx = lerp(-300, W + 300, shine); // блик проходит по буквам
  const sh = m.createLinearGradient(sx - 120, 0, sx + 120, 0);
  sh.addColorStop(0, 'rgba(255,240,200,0)'); sh.addColorStop(.5, 'rgba(255,240,200,.75)'); sh.addColorStop(1, 'rgba(255,240,200,0)');
  m.fillStyle = sh; m.fillRect(0, 0, W, 420);
  g.save(); g.globalAlpha = a; g.shadowColor = rgba(C.gold, .45); g.shadowBlur = 40;
  g.drawImage(metal, 0, y - 210); g.restore();
}

function reel(x, y, rx, a = 1) { // кинобобина в перспективе
  const ry = rx * .3, th = rx * .16;
  g.save(); g.globalAlpha = a;
  g.fillStyle = '#0B0908'; g.beginPath(); g.ellipse(x, y + th, rx, ry, 0, 0, Math.PI); g.lineTo(x - rx, y); g.ellipse(x, y, rx, ry, 0, Math.PI, 0, true); g.closePath(); g.fill();
  g.strokeStyle = rgba(C.gold, .55); g.lineWidth = 1.6;
  g.beginPath(); g.ellipse(x, y + th, rx, ry, 0, 0, Math.PI); g.stroke();
  g.fillStyle = '#0E0B09'; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill();
  const gr = g.createLinearGradient(x - rx, 0, x + rx, 0);
  gr.addColorStop(0, rgba(C.goldHi, .9)); gr.addColorStop(.5, rgba(C.gold, .35)); gr.addColorStop(1, rgba(C.goldDk, .6));
  g.strokeStyle = gr; g.lineWidth = 2.2; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.stroke();
  g.strokeStyle = rgba(C.gold, .35); g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, y, rx * .82, ry * .82, 0, 0, 7); g.stroke();
  for (let i = 0; i < 5; i++) { const an = i / 5 * 6.283 + .4;
    g.beginPath(); g.ellipse(x + Math.cos(an) * rx * .5, y + Math.sin(an) * ry * .5, rx * .13, ry * .13, 0, 0, 7); g.fillStyle = '#050404'; g.fill(); g.strokeStyle = rgba(C.gold, .4); g.stroke(); }
  g.beginPath(); g.ellipse(x, y, rx * .1, ry * .1, 0, 0, 7); g.fillStyle = rgba(C.goldHi, .6); g.fill();
  g.restore();
}
function beam(sx, sy, ex, ey, spread, a) { // луч проектора из точки
  if (a <= 0) return;
  const dx = ex - sx, dy = ey - sy, l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
  g.save(); g.globalCompositeOperation = 'lighter';
  const gr = g.createLinearGradient(sx, sy, ex, ey);
  gr.addColorStop(0, rgba('#FFE6B0', .42 * a)); gr.addColorStop(.35, rgba(C.gold, .16 * a)); gr.addColorStop(1, rgba(C.gold, 0));
  g.fillStyle = gr; g.filter = 'blur(6px)';
  g.beginPath(); g.moveTo(sx + nx * 6, sy + ny * 6); g.lineTo(ex + nx * spread, ey + ny * spread); g.lineTo(ex - nx * spread, ey - ny * spread); g.lineTo(sx - nx * 6, sy - ny * 6); g.closePath(); g.fill();
  g.restore();
  glow(sx, sy, 160, '#FFE6B0', .6 * a);
}
const flick = t => .82 + .18 * rng(Math.floor(t * 24) + 7)(); // мерцание проектора 24 к/с

// Иконки для кадров плёнки — золотая графика
function icon(kind, x, y, s, a, t) {
  g.save(); g.globalAlpha = a; g.strokeStyle = C.goldHi; g.fillStyle = C.goldHi; g.lineWidth = 2.4; g.lineCap = 'round';
  g.shadowColor = rgba(C.gold, .8); g.shadowBlur = 18;
  const S = s;
  switch (kind) {
    case 'eye':
      g.beginPath(); g.moveTo(x - 110 * S, y); g.quadraticCurveTo(x, y - 90 * S, x + 110 * S, y); g.quadraticCurveTo(x, y + 90 * S, x - 110 * S, y); g.stroke();
      g.beginPath(); g.ellipse(x, y, 12 * S, 40 * S, 0, 0, 7); g.fill(); break;
    case 'key':
      g.beginPath(); g.arc(x - 70 * S, y, 34 * S, 0, 7); g.stroke();
      g.beginPath(); g.moveTo(x - 36 * S, y); g.lineTo(x + 110 * S, y); g.moveTo(x + 70 * S, y); g.lineTo(x + 70 * S, y + 30 * S); g.moveTo(x + 95 * S, y); g.lineTo(x + 95 * S, y + 22 * S); g.stroke(); break;
    case 'wave':
      for (let k = 0; k < 5; k++) { g.beginPath(); for (let i = 0; i <= 40; i++) { const u = i / 40; const xx = x - 130 * S + u * 260 * S, yy = y + Math.sin(u * 7 + k * .5 + t * 2) * 30 * S + (k - 2) * 12 * S; i ? g.lineTo(xx, yy) : g.moveTo(xx, yy); } g.globalAlpha = a * (.3 + .15 * k); g.stroke(); } break;
    case 'curtain':
      g.beginPath(); g.moveTo(x - 130 * S, y - 90 * S); g.lineTo(x + 130 * S, y - 90 * S); g.stroke();
      for (let k = -4; k <= 4; k++) { g.beginPath(); g.moveTo(x + k * 28 * S, y - 90 * S); g.quadraticCurveTo(x + k * 32 * S, y, x + k * 26 * S + Math.sign(k) * 10 * S, y + 90 * S); g.stroke(); } break;
    case 'spark':
      g.restore(); star4(x, y, 60 * S, a); star4(x + 90 * S, y - 50 * S, 22 * S, a * .7); star4(x - 80 * S, y + 40 * S, 16 * S, a * .6); return;
    case 'gem':
      g.restore(); gem(x, y, 90 * S, 160 * S, a); return;
    case 'arch':
      g.restore(); arch(x, y + 110 * S, y - 110 * S, 80 * S, 1, a, 2.4); gem(x, y + 10 * S, 34 * S, 60 * S, a * .9); return;
    case 'reel':
      g.restore(); reel(x, y, 110 * S, a); return;
  }
  g.restore();
}
const FRAMES = ['eye', 'wave', 'key', 'arch', 'curtain', 'spark', 'reel', 'gem'];

// Прокрутка плёнки: интегрируем скорость (с остановкой на «Тишине»)
const SCROLL = (() => {
  const v = t => { if (t < 11.15) return lerp(260, 900, seg(t, 8.4, 11.15)); if (t < 11.95) return lerp(900, 0, seg(t, 11.15, 11.35)) + 0; return lerp(700, 5200, ei(seg(t, 11.95, 15))); };
  const out = [], dt = 1 / 240; let acc = 0;
  for (let t = 8.4; t <= 15.01; t += dt) { out.push(acc); acc += v(t) * dt; }
  return t => out[Math.min(out.length - 1, Math.max(0, Math.round((t - 8.4) / dt)))];
})();

// Бархатный занавес: open 0..1
function curtain(open, t, a = 1) {
  if (a <= 0) return;
  const N = 180, folds = 4.5;
  for (const side of [-1, 1]) {
    const width = (W / 2 + 8) * lerp(1, .13, eio(open));
    for (let i = 0; i < N; i++) {
      const u = i / N, u2 = (i + 1) / N;
      const x0 = side < 0 ? u * width : W - u * width, x1 = side < 0 ? u2 * width : W - u2 * width;
      const ph = u * folds * Math.PI * 2 * lerp(1, 1.7, open) + Math.sin(t * .8 + u * 3) * .3;
      const f = .5 + .5 * Math.sin(ph) * .85 + .15 * Math.sin(ph * 2.3 + 1.3) * .5; // крупные мягкие складки
      const lift = open * 260 * Math.pow(u, 2.2); // подхват к краю
      const gr = g.createLinearGradient(0, 0, 0, H);
      const base = [lerp(40, 196, f), lerp(3, 22, f), lerp(6, 30, f)];
      gr.addColorStop(0, `rgba(${base[0] * .45 | 0},${base[1] * .4 | 0},${base[2] * .4 | 0},${a})`);
      gr.addColorStop(.45, `rgba(${base[0] | 0},${base[1] | 0},${base[2] | 0},${a})`);
      gr.addColorStop(1, `rgba(${base[0] * .35 | 0},${base[1] * .3 | 0},${base[2] * .3 | 0},${a})`);
      g.fillStyle = gr; g.fillRect(Math.min(x0, x1) - .5, 0, Math.abs(x1 - x0) + 1, H - lift);
    }
    // золотая кайма по внутреннему краю
    const ex = side < 0 ? width : W - width;
    g.save(); g.globalAlpha = a; g.strokeStyle = rgba(C.goldHi, .8); g.lineWidth = 3; g.shadowColor = rgba(C.gold, .9); g.shadowBlur = 14;
    g.beginPath(); g.moveTo(ex, 0); g.lineTo(ex, H - open * 260); g.stroke(); g.restore();
  }
}

/* ---------- сцены ---------- */
function sIdent(t) { // 0–3.6
  const a = seg(t, .15, .9) * flick(t);
  beam(-40, 260, 760, 1500, 330, a);
  reel(540, 1330, 190, seg(t, .3, 1.2)); reel(540, 1270, 176, seg(t, .3, 1.2));
  silhouette(TAIL, 540, 1262, 2.1, { light: [-.8, -.7], rimA: .9 * a, fur: 1.2, glowA: .2 });
  silhouette(CAT, 540, 1262, 2.1, { light: [-.8, -.7], rimA: a, fur: 1.5, glowA: .45 });
  catFace(540, 1262, 2.1, eo(seg(t, 1.0, 1.5)) * (t > 2.6 && t < 2.75 ? .1 : 1), .1, 1, bell(t, 1.5, 2.3, .2, .5));
  text('TAINA STUDIO', W / 2, 1560, 40, C.gold, bell(t, 1.8, 3.6, .5, .4), { caps: true, ls: 18, weight: 600, glowA: .3 });
  text('представляет', W / 2, 1625, 44, C.ink, bell(t, 2.1, 3.6, .5, .4), { italic: true });
  g.fillStyle = rgba(C.void, seg(t, 3.25, 3.6)); g.fillRect(0, 0, W, H);
}

const QUESTION = [['Что', 'остаётся'], ['от', 'бренда,'], ['когда', 'реклама'], ['закончилась?']];
function sQuestion(t) { // 3.6–8.4
  const z = lerp(1, 1.05, seg(t, 3.6, 8.4));
  g.save(); g.translate(W / 2, H / 2); g.scale(z, z); g.translate(-W / 2, -H / 2);
  glow(W / 2, 900, 700, '#5A3A12', .25, 'source-over');
  let k = 0;
  QUESTION.forEach((line, li) => {
    const y = 700 + li * 125;
    g.font = `italic 500 104px ${SERIF}`; g.letterSpacing = '0px';
    const full = line.join(' '), wFull = g.measureText(full).width;
    let x = W / 2 - wFull / 2;
    line.forEach(word => {
      const s0 = 3.9 + k * .38, a = seg(t, s0, s0 + .5) * (1 - seg(t, 7.9, 8.4));
      const ww = g.measureText(word + ' ').width;
      const hot = word === 'остаётся';
      g.save(); g.globalAlpha = a; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillStyle = hot ? C.goldHi : C.ink; g.shadowColor = rgba(C.gold, hot ? .8 : .3); g.shadowBlur = hot ? 50 : 30;
      g.fillText(word, x, y + (1 - eo(seg(t, s0, s0 + .5))) * 18); g.restore();
      x += ww; k++;
    });
  });
  g.restore();
}

const BEATS = [[9.2, 'Свет.'], [10.2, 'Ритм.'], [11.2, 'Тишина.'], [12.4, 'Характер.'], [13.3, 'Смысл.']];
function sFilm(t) { // 8.4–15
  const sc = SCROLL(t), pitch = 600, fw = 700, fh = 520, x0 = W / 2 - fw / 2 - 50;
  const speed = (SCROLL(Math.min(15, t + 1 / 60)) - SCROLL(t)) * 60;
  const blur = clamp(speed / 900, 0, 6);
  const silence = t > 11.15 && t < 11.95;
  g.save();
  if (blur > .3) g.filter = `blur(${blur.toFixed(1)}px)`;
  // тело плёнки
  g.fillStyle = '#0A0807'; g.fillRect(x0, 0, fw + 100, H);
  g.strokeStyle = rgba(C.gold, .35); g.lineWidth = 1.5; g.strokeRect(x0, -10, fw + 100, H + 20);
  // перфорация
  const hp = 64, off = -(sc % hp);
  for (let y = off - hp; y < H + hp; y += hp) for (const hx of [x0 + 14, x0 + fw + 64]) {
    g.fillStyle = C.void; g.beginPath(); g.roundRect(hx, y, 22, 36, 5); g.fill(); g.strokeStyle = rgba(C.gold, .25); g.stroke();
  }
  // кадры
  const first = Math.floor((sc - 200) / pitch);
  for (let i = first; i < first + 5; i++) {
    const y = i * pitch - sc + 200;
    if (y > H || y + fh < 0) continue;
    const fx = x0 + 50, kind = FRAMES[((i % FRAMES.length) + FRAMES.length) % FRAMES.length];
    const vg = g.createRadialGradient(fx + fw / 2, y + fh / 2, 40, fx + fw / 2, y + fh / 2, fw * .7);
    vg.addColorStop(0, '#2A1A0C'); vg.addColorStop(1, '#070504');
    g.fillStyle = vg; g.fillRect(fx, y, fw, fh);
    g.strokeStyle = rgba(C.gold, .3); g.lineWidth = 1; g.strokeRect(fx + .5, y + .5, fw - 1, fh - 1);
    g.save(); g.filter = 'none'; icon(kind, fx + fw / 2, y + fh / 2, 1.3, .95, t); g.restore();
    text(String(((i % 99) + 99) % 99 + 1).padStart(2, '0'), fx + 40, y + 36, 26, C.gold, .6, { weight: 600, glowA: 0 });
  }
  g.restore();
  // затемнение краёв
  let gr = g.createLinearGradient(0, 0, 0, 380); gr.addColorStop(0, C.void); gr.addColorStop(1, rgba(C.void, 0)); g.fillStyle = gr; g.fillRect(0, 0, W, 380);
  gr = g.createLinearGradient(0, H - 380, 0, H); gr.addColorStop(0, rgba(C.void, 0)); gr.addColorStop(1, C.void); g.fillStyle = gr; g.fillRect(0, H - 380, W, 380);
  if (silence) { g.fillStyle = rgba(C.void, .55 * bell(t, 11.15, 11.95, .15, .2)); g.fillRect(0, 0, W, H); }
  // слова на битах
  BEATS.forEach(([s0, w], i) => {
    const a = bell(t, s0, s0 + (i === 2 ? .8 : .7), .05, .25);
    if (a > 0) text(w, W / 2, H / 2 + (i % 2 ? 60 : -60), i === 2 ? 150 : 138, i === 2 ? C.ink : C.goldHi, a, { weight: 600, glowA: .8 });
  });
  const fl = bell(t, 14.6, 15.1, .3, .2); if (fl > 0) { g.fillStyle = rgba('#FFE9C8', fl * .9); g.fillRect(0, 0, W, H); }
}

function sAnswer(t) { // 15–19
  glow(W / 2, 860, 800, '#6A3A10', .3 * seg(t, 15, 16), 'source-over');
  const a1 = seg(t, 15.2, 16);
  g.save(); g.globalAlpha = a1; g.translate(W / 2, 840); const sc = lerp(1.08, 1, eo(seg(t, 15.2, 17))); g.scale(sc, sc);
  text('Ощущение.', 0, 0, 150, C.goldHi, 1, { italic: true, weight: 500, glowA: .9 }); g.restore();
  divider(960, 220, seg(t, 16.1, 16.9), 1);
  text('Его невозможно объяснить.', W / 2, 1060, 64, C.ink, seg(t, 16.5, 17.2), { italic: true });
  text('Его можно снять.', W / 2, 1150, 72, C.ink, seg(t, 17.4, 18.1), { weight: 600, glowA: .5 });
  g.fillStyle = rgba(C.void, seg(t, 18.6, 19)); g.fillRect(0, 0, W, H);
}

function sReveal(t) { // 19–24.5 и дальше — фон премьеры
  const open = seg(t, 19.5, 21.6);
  const D = { x: 540, y: 760 };
  // сцена за занавесом
  glow(W / 2, 820, 900, '#5A1A08', .5 * seg(t, 19.6, 21), 'source-over');
  arch(540, 1330, 330, 330, eo(seg(t, 20.2, 21.8)), .8, 2);
  arch(540, 1330, 380, 290, eo(seg(t, 20.4, 22)), .35, 1.2);
  const gA = eo(seg(t, 20.6, 21.4));
  gem(D.x, D.y, 150 * gA + 1, 270 * gA + 1, gA);
  flare(D.x, D.y, lerp(200, 700, eo(seg(t, 20.9, 22))), bell(t, 20.9, 23.2, .25, 1.2) * .95);
  for (let i = 0; i < 9; i++) star4(D.x + Math.cos(i * 2.1 + t * .4) * (230 + i * 15), D.y + Math.sin(i * 2.1 + t * .4) * 180, 6 + i % 3 * 3, seg(t, 21.5, 22.5) * (.4 + .4 * Math.sin(t * 3 + i)));
  ribbon(t, 1680, 70, 110, C.red, '#FF6A5A', seg(t, 21.5, 23) * .8, 0, .5);
  goldWord('TAINA', 1090, 230, 10, seg(t, 21.9, 22.8), seg(t, 22.2, 23.6));
  goldWord('STUDIO', 1250, 76, 32, seg(t, 22.3, 23), seg(t, 22.6, 24));
  text('Имиджевые фильмы для брендов', W / 2, 1360, 33, C.goldHi, seg(t, 22.8, 23.5), { caps: true, ls: 5, weight: 600, glowA: .3 });
  curtain(open, t); // раскрытый занавес остаётся по краям кадра
}

function sPremiere(t) { // 24.5–30
  sReveal(t);
  divider(1470, 280, seg(t, 24.5, 25.3), 1);
  text('Премьера направления', W / 2, 1550, 50, C.goldHi, seg(t, 24.8, 25.5), { caps: true, ls: 12, weight: 600, glowA: .5 });
  text('Ваша история — следующая.', W / 2, 1650, 70, C.ink, seg(t, 25.8, 26.6), { italic: true });
}

function sTeaserEnd(t) { // 30–32
  const a = seg(t, 30, 30.5);
  gem(540, 780, 110 * a + 1, 190 * a + 1, a);
  flare(540, 780, 420, bell(t, 30.1, 31.4, .2, .8) * .8);
  goldWord('TAINA', 1040, 200, 10, a, seg(t, 30.2, 31.5));
  goldWord('STUDIO', 1180, 66, 30, a, seg(t, 30.4, 31.7));
  divider(1300, 220, seg(t, 30.3, 31), 1);
  text('Премьера · скоро', W / 2, 1390, 58, C.ink, seg(t, 30.5, 31.1), { italic: true });
}

function sPoster() { // ключевой визуал
  const t = 23.6;
  beam(-40, 180, 820, 1700, 360, .7);
  sReveal(t);
  text('Премьера направления', W / 2, 1480, 46, C.goldHi, 1, { caps: true, ls: 12, weight: 600, glowA: .5 });
  text('Ваша история — следующая.', W / 2, 1565, 62, C.ink, 1, { italic: true });
  reel(955, 1895, 92, 1); reel(955, 1866, 84, 1);
  silhouette(CAT, 955, 1860, .74, { light: [-.8, -.7], rimA: 1, fur: .8, glowA: .45 });
  catFace(955, 1860, .74, 1, .1, 1, .8);
}

/* ---------- кадр ---------- */
function render(t) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
  g.fillStyle = C.void; g.fillRect(0, 0, W, H);
  if (t >= 40) sPoster();
  else if (t < 3.6) sIdent(t);
  else if (t < 8.4) sQuestion(t);
  else if (t < 15) sFilm(t);
  else if (t < 19) sAnswer(t);
  else if (t < 24.5) sReveal(t);
  else if (t < 30) sPremiere(t);
  else sTeaserEnd(t);
  // пыль
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const d of dust) {
    const y = ((d.y - t * d.v) % H + H) % H, x = d.x + Math.sin(t * .4 + d.ph) * 18;
    const inBeam = t < 3.6 && (y - 260) > (x + 40) * .7 && (y - 260) < (x + 40) * 2.2 ? 2.2 : 1;
    g.fillStyle = rgba(C.goldHi, d.a * (.55 + .45 * Math.sin(t * 1.7 + d.ph)) * .5 * inBeam);
    g.fillRect(x, y, d.s, d.s);
  }
  g.restore();
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = .14;
  g.drawImage(grains[Math.floor(t * 24) % 4], 0, 0, W, H);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  const vg = g.createRadialGradient(W / 2, H / 2, W * .45, W / 2, H / 2, H * .75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.62)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  // «киношные» полосы-кашеты на заставке
  const bars = 1 - seg(t, 3.2, 3.6); if (t < 3.6) { g.fillStyle = '#000'; g.fillRect(0, 0, W, 120 * bars); g.fillRect(0, H - 120 * bars, W, 120 * bars); }
  if (t > 29.5 && t < 30) { g.fillStyle = rgba(C.void, seg(t, 29.5, 30)); g.fillRect(0, 0, W, H); }
  if (t > 31.6 && t < 40) { g.fillStyle = rgba(C.void, seg(t, 31.6, 32)); g.fillRect(0, 0, W, H); }
}
window.render = render;
window.ready = Promise.all(['500 80px', 'italic 500 80px', '600 58px'].map(f => document.fonts.load(`${f} ${SERIF}`, 'Ответ TAINA'))).then(() => document.fonts.ready);

const qt = new URLSearchParams(location.search).get('t');
if (!navigator.webdriver) window.ready.then(() => {
  if (qt !== null) return render(parseFloat(qt));
  const t0 = performance.now();
  const loop = now => { render(((now - t0) / 1000) % DUR); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
});
