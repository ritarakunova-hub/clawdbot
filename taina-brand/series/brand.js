// Элементы бренда из трейлера-премьеры: металлическое золото, стопка документов, луч, карточки.
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

function docStack(x, y, w, a = 1) { // стопка папок и документов
  const rows = [[0, 0, 1], [8, -34, .94], [-10, -66, 1.04], [4, -96, .9]];
  g.save(); g.globalAlpha = a;
  for (const [dx, dy, k] of rows) {
    const ww = w * k, bx = x - ww / 2 + dx, by = y + dy - 30;
    g.fillStyle = '#0D0A08'; g.fillRect(bx, by, ww, 30);
    g.strokeStyle = rgba(C.gold, .55); g.lineWidth = 1.4; g.strokeRect(bx, by, ww, 30);
    g.fillStyle = rgba(C.goldHi, .35); g.fillRect(bx + ww * .1, by + 13, ww * .5, 2);
  }
  g.save(); g.translate(x + w * .42, y - 44); g.rotate(Math.PI / 4); g.fillStyle = C.red; g.shadowColor = C.red; g.shadowBlur = 14; g.fillRect(-5, -5, 10, 10); g.restore();
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

// Карточка документа для ленты
function docCard(fx, y, fw, fh, title, hot, a) {
  const vg = g.createRadialGradient(fx + fw / 2, y + fh / 2, 40, fx + fw / 2, y + fh / 2, fw * .7);
  vg.addColorStop(0, '#22170C'); vg.addColorStop(1, '#080605');
  g.fillStyle = vg; g.fillRect(fx, y, fw, fh);
  g.strokeStyle = rgba(C.gold, .35); g.lineWidth = 1; g.strokeRect(fx + .5, y + .5, fw - 1, fh - 1);
  text(title, fx + fw / 2, y + 110, 58, C.goldHi, a, { weight: 600, glowA: .5 });
  g.save(); g.globalAlpha = a;
  for (let i = 0; i < 7; i++) { g.fillStyle = rgba(C.gold, .22); g.fillRect(fx + 80, y + 190 + i * 38, (fw - 160) * (i % 3 === 2 ? .55 : .9), 3); }
  g.restore();
  if (hot) { g.save(); g.translate(fx + fw - 60, y + 56); g.rotate(Math.PI / 4); g.fillStyle = C.red; g.shadowColor = C.red; g.shadowBlur = 16; g.fillRect(-8, -8, 16, 16); g.restore(); }
}

// Ответ ассистента со ссылкой на источник
function answerCard(y, a, t, t0) {
  if (a <= 0) return;
  const x = 130, w = 820, h = 330;
  g.save(); g.globalAlpha = a; g.translate(0, (1 - eo(a)) * 24);
  g.fillStyle = 'rgba(14,10,9,.94)'; g.fillRect(x, y, w, h);
  g.strokeStyle = rgba(C.gold, .55); g.lineWidth = 1.4; g.strokeRect(x, y, w, h);
  g.restore();
  const q = 'Какая схема приёма для повторных пациентов?';
  const n = Math.floor(q.length * seg(t, t0 + .2, t0 + 1.1));
  const cut = 'Какая схема приёма '.length;
  g.save(); g.textAlign = 'left';
  text('ВОПРОС', x + 150, y + 50, 24, C.gold, a, { weight: 600, ls: 6, glowA: 0 });
  g.restore();
  const tl = (str, yy, size, col, aa, opt = {}) => { g.save(); g.globalAlpha = aa; g.font = `${opt.italic ? 'italic ' : ''}${opt.w || 500} ${size}px ${SERIF}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = col; g.shadowColor = rgba(C.gold, .3); g.shadowBlur = 16; g.fillText(str, x + 44, yy); g.restore(); };
  tl(q.slice(0, Math.min(n, cut)), y + 104, 44, C.ink, a, { w: 600 });
  tl(n > cut ? q.slice(cut, n) : '', y + 154, 44, C.ink, a, { w: 600 });
  tl('Повторный приём — по записи, без направления.', y + 220, 34, C.goldHi, a * seg(t, t0 + 1.2, t0 + 1.6), { italic: true });
  g.save(); g.globalAlpha = a * seg(t, t0 + 1.6, t0 + 2); g.fillStyle = rgba(C.gold, .3); g.fillRect(x + 44, y + 256, w - 88, 1); g.restore();
  tl('↳ Источник: Регламент приёма, п. 3.2', y + 290, 32, C.gold, a * seg(t, t0 + 1.7, t0 + 2.1), { w: 600 });
}
