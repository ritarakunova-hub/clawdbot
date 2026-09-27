// Серия 2 «Дом для знаний». 37 с.
// 0–3.6 титр · 3.6–11 кот входит в студию: камера, свет, горы документов
// 11–22 «У твоих документов тоже нет дома…» — «Поможешь им?» — «Я вижу больше.»
// 22–29 документы по золотым нитям улетают на полки-арку, загорается ромб · 29–34.2 финал · 34.2–37 карточка

const FLOOR2 = 1500;
const FLY = (() => { const r = rng(91); return Array.from({ length: 44 }, (_, i) => ({ sx: 260 + r() * 520, sy: FLOOR2 - 20 - r() * 260, rot: r() * 6.28, w: 40 + r() * 40, cell: Math.floor(r() * 63), d: r() * 4.8 })); })();
const DRIFT = (() => { const r = rng(92); return Array.from({ length: 14 }, () => ({ x: r() * W, y: 300 + r() * 900, v: 30 + r() * 50, rot: r() * 6.28, w: 30 + r() * 40, ph: r() * 6 })); })();

function studio(t, fill, shelfA) {
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0B0806'); bg.addColorStop(.7, '#140E09'); bg.addColorStop(1, '#070504');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  glow(540, 900, 900, '#3A2412', .5, 'source-over');
  const cells = shelfWall(fill, t, shelfA);
  const gA = seg(t, 27.6, 28.6);
  gem(SHELF.x, SHELF.top + 150, 70 * gA + 1, 120 * gA + 1, gA);
  flare(SHELF.x, SHELF.top + 150, 420, bell(t, 27.8, 30, .3, 1.2) * .9);
  // пол
  const fg = g.createLinearGradient(0, FLOOR2, 0, H); fg.addColorStop(0, '#1A120B'); fg.addColorStop(1, '#070504');
  g.fillStyle = fg; g.fillRect(0, FLOOR2, W, H - FLOOR2);
  g.fillStyle = rgba(C.gold, .25); g.fillRect(0, FLOOR2, W, 2);
  filmCamera(150, FLOOR2, .8, 1, t * .3);
  lightStand(960, FLOOR2, .95, 1, 1);
  clapper(850, FLOOR2 - 50, .75);
  return cells;
}

function scene(t) {
  if (t >= 34.2) return endCard(t, 34.2, 2, 'Дом для знаний');
  const push = lerp(1, 1.06, seg(t, 0, 34));
  g.save(); g.translate(W / 2, H * .6); g.scale(push, push); g.translate(-W / 2, -H * .6);
  const fill = eio(seg(t, 22.5, 28.5));
  const cells = studio(t, fill, lerp(.3, 1, seg(t, 21.6, 23)));
  // горы бумаг уменьшаются, когда документы улетают
  paperPile(470, FLOOR2 + 6, 760, 300, 1, 1 - .85 * fill);
  // бумаги в воздухе
  for (const d of DRIFT) {
    const y = (d.y + t * d.v) % 1300 + 200;
    paperQuad(d.x + Math.sin(t + d.ph) * 40, y, d.w, d.rot + t * .6, .55 * (1 - fill), .8);
  }
  // полёт документов на полки
  if (t > 22 && t < 29.5) for (const f of FLY) {
    const q = seg(t, 22.4 + f.d * .9, 23.6 + f.d * .9);
    if (q <= 0 || q >= 1) continue;
    const [cx, cy] = cells[f.cell] || cells[0];
    const tx = cx + 30, ty = cy + 30, mx = (f.sx + tx) / 2, my = Math.min(f.sy, ty) - 260;
    const u = eio(q), x = (1 - u) * (1 - u) * f.sx + 2 * (1 - u) * u * mx + u * u * tx, y = (1 - u) * (1 - u) * f.sy + 2 * (1 - u) * u * my + u * u * ty;
    g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba(C.goldHi, .45 * (1 - q)); g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(CATP.x - 24, CATP.y - 222 * CATP.s); g.quadraticCurveTo(mx, my, x, y); g.stroke(); g.restore();
    paperQuad(x, y, f.w * lerp(1, .5, q), f.rot + q * 6, 1, 1);
  }
  // кот: входит в профиль, потом сидит анфас
  const sitA = seg(t, 10.4, 11.1);
  if (sitA < 1) {
    const x = lerp(-280, 470, eo(seg(t, 3.6, 10.2)));
    g.save(); g.globalAlpha = 1 - sitA;
    catWalk(x, FLOOR2 + 10, 1.55, x / 55, { light: [1, -.5], rimA: 1, headDown: -.5 * bell(t, 4, 9.5, .6, .6), bob: t < 10.2 });
    g.restore();
  }
  if (sitA > 0) {
    g.save(); g.globalAlpha = sitA;
    silhouette(TAIL, CATP.x, CATP.y, CATP.s, { light: [1, -.5], rimA: .9, fur: .8, glowA: .2 });
    fluffy(CAT, CATP.x, CATP.y, CATP.s, { light: [1, -.5], rimA: 1, fur: .6, glowA: .4, fluff: .9 });
    const blink = (t > 15.2 && t < 15.35) ? .1 : 1;
    const flareE = bell(t, 20.3, 23.5, .3, 1);
    catFace(CATP.x, CATP.y, CATP.s, blink, .1, 1, flareE);
    for (const [ex, ey] of CAT_EYES) glow(CATP.x + ex * CATP.s, CATP.y + ey * CATP.s, 120 * flareE, C.goldHi, .6 * flareE);
    g.restore();
  }
  g.restore();
  titleCard(t, .6, 3.8, 2, 'Дом для знаний');
  sub(t, 4.2, 6.9, 'Бегемот', 'Это… киностудия?');
  sub(t, 7.1, 10.1, 'Маргарита', 'Студия. И дом для всего,\nчто компании знают о себе.');
  sub(t, 11.3, 14.3, 'Бегемот', 'У твоих документов\nтоже нет дома.');
  sub(t, 14.5, 17.3, 'Бегемот', 'Они скитаются.\nКак я вчера.');
  sub(t, 17.5, 19.7, 'Маргарита', 'Поможешь им?');
  sub(t, 19.9, 22.3, 'Бегемот', 'Я вижу больше.');
  sub(t, 29.2, 31.7, 'Маргарита', 'Теперь у каждого\nдокумента есть дом.');
  sub(t, 31.9, 34.2, 'Бегемот', 'А у каждого ответа —\nадрес.');
  if (t < .8) { g.fillStyle = rgba(C.void, 1 - seg(t, 0, .8)); g.fillRect(0, 0, W, H); }
}
const CATP = { x: 800, y: FLOOR2 + 4, s: 1.25 };
window.EP = { dur: 37, scene };
window.FILM = { w: W, h: H, dur: 37 };
