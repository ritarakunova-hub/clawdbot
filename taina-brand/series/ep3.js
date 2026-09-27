// Серия 3 «Первый гость». 38 с.
// 0–3.6 ночь в студии, дождь в окне, титр · 3.6–11.6 стук, входит промокший гость
// 11.8–18 вопрос гостя, у Бегемота загораются глаза · 18–26 документ слетает с полки: ответ со ссылкой
// 26–35 «Ответ уже был у вас. Я просто знаю, где искать.» · 35–38 финальная карточка главы

const FLOOR3 = 1500, DESK = { x: 760, top: 1230 }, CAT3 = { x: 790, y: 1232, s: 1.0 }, HOT = 24;

function nightStudio(t) {
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#08060A'); bg.addColorStop(1, '#0A0706');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // окно с дождём и огнями города
  const wx = 900, wt = 380, wb = 1150, wh = 130;
  g.save(); g.beginPath(); g.moveTo(wx - wh, wb); g.lineTo(wx - wh, wt + wh); g.quadraticCurveTo(wx - wh, wt, wx, wt - 30); g.quadraticCurveTo(wx + wh, wt, wx + wh, wt + wh); g.lineTo(wx + wh, wb); g.closePath(); g.clip();
  const sg = g.createLinearGradient(0, wt, 0, wb); sg.addColorStop(0, '#0A1220'); sg.addColorStop(1, '#101A28'); g.fillStyle = sg; g.fillRect(0, 0, W, H);
  const br = rng(5); for (let i = 0; i < 30; i++) glow(wx - wh + br() * wh * 2, wt + 200 + br() * 560, 10 + br() * 24, br() > .5 ? NIGHT.lamp : '#9FC3FF', .35);
  g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba(NIGHT.cool, .35); g.lineWidth = 1;
  for (const d of RAIN.slice(0, 90)) { const y = ((d.y + t * d.v * .6) % 900) + wt; g.beginPath(); g.moveTo(wx - wh + d.x % (wh * 2), y); g.lineTo(wx - wh + d.x % (wh * 2) - 6, y - d.l * .6); g.stroke(); }
  g.restore();
  arch(wx, wb, wt - 30, wh, 1, .8, 2);
  g.strokeStyle = rgba(C.gold, .35); g.lineWidth = 2; g.beginPath(); g.moveTo(wx, wt - 20); g.lineTo(wx, wb); g.moveTo(wx - wh, 800); g.lineTo(wx + wh, 800); g.stroke();
  // полки (заполнены) слева-по центру — меньше, чем во 2 серии
  g.save(); g.translate(400, 1500); g.scale(.82, .82); g.translate(-SHELF.x, -SHELF.base);
  const hot = bell(t, 16.2, 21, .5, 1);
  const cells = shelfWall(1, t, .95, HOT, hot);
  gem(SHELF.x, SHELF.top + 150, 70, 120, 1);
  g.restore();
  // пол, стол, камера
  const fg = g.createLinearGradient(0, FLOOR3, 0, H); fg.addColorStop(0, '#171009'); fg.addColorStop(1, '#060403');
  g.fillStyle = fg; g.fillRect(0, FLOOR3, W, H - FLOOR3); g.fillStyle = rgba(C.gold, .22); g.fillRect(0, FLOOR3, W, 2);
  g.fillStyle = '#0E0A08'; g.fillRect(DESK.x - 230, DESK.top, 460, 26); g.fillRect(DESK.x - 210, DESK.top + 26, 20, FLOOR3 - DESK.top - 26); g.fillRect(DESK.x + 190, DESK.top + 26, 20, FLOOR3 - DESK.top - 26);
  g.fillStyle = rgba(C.gold, .5); g.fillRect(DESK.x - 230, DESK.top, 460, 2);
  glow(DESK.x - 120, DESK.top - 60, 200, NIGHT.warm, .3);
  docStack(DESK.x - 130, DESK.top, 170, 1);
  return { cells, shelfMap: (cx, cy) => ({ x: 400 + (cx - SHELF.x) * .82, y: 1500 + (cy - SHELF.base) * .82 }) };
}

function umbrella(x, y, s, open, a) {
  if (a <= 0) return;
  g.save(); g.globalAlpha = a; g.translate(x, y); g.scale(s, s);
  g.strokeStyle = C.fur; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -240); g.stroke();
  g.beginPath(); g.arc(-10, 0, 10, 0, Math.PI); g.stroke();
  if (open > .05) {
    g.fillStyle = '#07080B'; g.beginPath(); g.moveTo(-170 * open, -210); g.quadraticCurveTo(0, -330, 170 * open, -210);
    for (let i = 4; i >= -4; i--) g.quadraticCurveTo(i * 42 * open + 21 * open, -228, i * 42 * open - 21 * open + 0, -210);
    g.closePath(); g.fill();
    g.strokeStyle = rgba(NIGHT.cool, .7); g.lineWidth = 2; g.beginPath(); g.moveTo(-170 * open, -210); g.quadraticCurveTo(0, -330, 170 * open, -210); g.stroke();
  } else { g.fillStyle = '#07080B'; g.beginPath(); g.moveTo(-10, -240); g.lineTo(12, -240); g.lineTo(0, -80); g.fill(); }
  g.restore();
}

function scene(t) {
  if (t >= 35) {
    endCard(t, 35, 3, 'Первый гость', 'Конец первой главы');
    text('Ответ уже есть. TAINA помогает его найти.', W / 2, 1320, 44, C.ink, seg(t, 36.3, 37), { italic: true });
    return;
  }
  const push = lerp(1, 1.12, eio(seg(t, 26, 35)));
  g.save(); g.translate(CAT3.x, CAT3.y - 200); g.scale(push, push); g.translate(-CAT3.x, -(CAT3.y - 200));
  const S = nightStudio(t);
  // дверь слева: открывается, входит гость
  const open = bell(t, 4.6, 29.5, .7, 1.2);
  const dx = 130, G = FLOOR3;
  taina(dx, G, t, 0, .9);
  if (open > 0) {
    g.save(); g.globalAlpha = open; g.beginPath(); g.rect(dx - 100, G - 420, 200, 420); g.clip(); g.fillStyle = '#0B1320'; g.fillRect(dx - 100, G - 420, 200, 420); rain(t, .8 * open); g.restore();
  }
  const gx = t < 7.5 ? lerp(dx, 330, eo(seg(t, 5.2, 7.5))) : t < 28.6 ? 330 : lerp(330, dx, eio(seg(t, 28.6, 30)));
  const ga = seg(t, 5.2, 5.8) * (1 - seg(t, 29.6, 30.2));
  if (ga > 0) {
    g.save(); g.globalAlpha = ga;
    silhouette(GUEST, gx, G, 1.55, { light: [1, -.4], rim: '#FFC27A', rimA: 1, fur: 0, glowA: .35 });
    umbrella(gx - 70, G - 160, 1.0, 1 - seg(t, 7.2, 8.2), 1);
    paperQuad(gx + 50, G - 300, 70, .3, .9, .8);
    g.restore();
  }
  // Маргарита у полок (силуэт, контровой свет от полок)
  silhouette(MARGO, 560, G, 1.2, { light: [-1, -.3], rim: '#FFD9A0', rimA: .8, fur: 0, glowA: .3 });
  // кот на столе
  const eyes = bell(t, 15.8, 22, .4, 1.2);
  silhouette(TAIL, CAT3.x, CAT3.y, CAT3.s, { light: [-.8, -.6], rimA: .9, fur: .8, glowA: .2 });
  fluffy(CAT, CAT3.x, CAT3.y, CAT3.s, { light: [-.8, -.6], rimA: 1, fur: .6, glowA: .4, fluff: .9 });
  catFace(CAT3.x, CAT3.y, CAT3.s, (t > 3.8 && t < 3.95) ? .1 : 1, .1, 1, Math.max(eyes, bell(t, 3.9, 4.6, .15, .4)));
  for (const [ex, ey] of CAT_EYES) glow(CAT3.x + ex * CAT3.s, CAT3.y + ey * CAT3.s, 120 * eyes, C.goldHi, .6 * eyes);
  // нить к нужной полке и полёт документа
  const [hcx, hcy] = S.cells[HOT], hp = S.shelfMap(hcx + 30, hcy + 30);
  const th = bell(t, 16.3, 21, .6, .8);
  if (th > 0) { g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba(C.goldHi, .8 * th); g.lineWidth = 2; g.shadowColor = C.goldHi; g.shadowBlur = 12;
    g.beginPath(); g.moveTo(CAT3.x, CAT3.y - 222 * CAT3.s); g.quadraticCurveTo((CAT3.x + hp.x) / 2, Math.min(hp.y, CAT3.y) - 200, hp.x, hp.y); g.stroke(); g.restore(); }
  const fly = seg(t, 17.4, 18.6);
  if (fly > 0 && fly < 1) { const u = eio(fly); paperQuad(lerp(hp.x, 540, u), lerp(hp.y, 800, u) - Math.sin(u * 3.14) * 120, lerp(40, 160, u), u * 6, 1, 1); glow(lerp(hp.x, 540, u), lerp(hp.y, 800, u), 120, C.goldHi, .5); }
  g.restore();
  answerCard(640, bell(t, 18.5, 26, .5, .6), t, 18.5);
  // тексты
  titleCard(t, .6, 3.6, 3, 'Первый гость');
  shout(t, 3.8, 5.0, 'Тук-тук.', 250, 900);
  sub(t, 6.6, 9.4, 'Гость', 'Мне сказали,\nздесь находят ответы.');
  sub(t, 9.6, 11.6, 'Маргарита', 'Спросите у Бегемота.');
  sub(t, 11.8, 15.6, 'Гость', 'Какая схема приёма для повторных\nпациентов? Я неделю ищу…');
  sub(t, 23.4, 26.0, 'Гость', 'Так это же наш регламент…');
  sub(t, 26.2, 29.8, 'Бегемот', 'Ответ уже был у вас.\nЯ просто знаю, где искать.');
  sub(t, 30.2, 32.3, 'Маргарита', 'Больше не скитаешься?');
  sub(t, 32.5, 35, 'Бегемот', 'Теперь я помогаю\nнайти дорогу другим.');
}
window.EP = { dur: 38, scene };
window.FILM = { w: W, h: H, dur: 38 };
