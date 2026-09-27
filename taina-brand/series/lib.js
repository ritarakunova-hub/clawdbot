// Библиотека мини-сериала «Бегемот»: пушистый кот в профиль, дождь, Петербург, двери, персонажи,
// студия, полки, субтитры, титры. Кадр 1080×1920. Эпизод задаёт EP = { dur, scene(t) }.

const NIGHT = { sky0: '#05070B', sky1: '#0C1017', cool: '#8FA6BC', lamp: '#FFC873', warm: '#FFB45A', stone: '#0E1116' };

/* ---------- пушистый силуэт ---------- */
// Как silhouette(), но с тёмным «пухом» по всему контуру: кот выглядит пушистым на любом фоне
function fluffy(S, x, y, s, opt = {}) {
  const { fluff = 1, rot = 0 } = opt;
  g.save(); g.translate(x, y); g.rotate(rot);
  const P = S.map(p => ({ X: p.x * s, Y: p.y * s, nx: p.nx, ny: p.ny, r1: p.r1, r2: p.r2, r3: p.r3 }));
  g.strokeStyle = C.fur; g.lineCap = 'round';
  for (const p of P) for (const rr of [p.r1, p.r2, p.r3, (p.r1 + p.r2) % 1]) {
    const len = (3 + 7 * rr) * fluff, an = Math.atan2(p.ny, p.nx) + (p.r3 - .5) * 1.4 + (rr - .5) * .9;
    g.lineWidth = 1.6 + rr * 1.2; g.beginPath(); g.moveTo(p.X - p.nx * 5, p.Y - p.ny * 5); g.lineTo(p.X + Math.cos(an) * len, p.Y + Math.sin(an) * len); g.stroke();
  }
  g.restore();
  g.save(); g.translate(x, y); g.rotate(rot);
  silhouette(S, 0, 0, s, opt);
  g.restore();
}
// Толстая линия с контровым светом (лапы, хвост): обводка светом со сдвигом к источнику, сверху — чёрная
function limb(pts, w0, w1, light, rimA, rim = C.goldHi, furLen = 0, seed = 1) {
  const [lx, ly] = light, l = Math.hypot(lx, ly), dx = lx / l * 2.6, dy = ly / l * 2.6;
  const r = rng(seed);
  const pass = (ox, oy, col, extra) => {
    g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
    for (let i = 0; i < pts.length - 1; i++) {
      const k = i / (pts.length - 1);
      g.lineWidth = lerp(w0, w1, k) + extra;
      g.beginPath(); g.moveTo(pts[i][0] + ox, pts[i][1] + oy); g.lineTo(pts[i + 1][0] + ox, pts[i + 1][1] + oy); g.stroke();
    }
  };
  if (rimA > 0) { g.save(); g.shadowColor = rgba(rim, .6 * rimA); g.shadowBlur = 12; pass(dx, dy, rgba(rim, .9 * rimA), 0); g.restore(); }
  pass(0, 0, C.fur, 0);
  if (furLen > 0) { // пух на хвосте
    g.save(); g.lineCap = 'round';
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], tx = x1 - x0, ty = y1 - y0, tl = Math.hypot(tx, ty) || 1;
      const nx = -ty / tl, ny = tx / tl, wv = lerp(w0, w1, i / (pts.length - 1)) / 2;
      for (let j = 0; j < 5; j++) for (const sg of [-1, 1]) {
        const u = r(), px = lerp(x0, x1, u) + nx * wv * sg, py = lerp(y0, y1, u) + ny * wv * sg, len = furLen * (.5 + r());
        const lit = Math.max(0, (nx * sg * lx + ny * sg * ly) / l);
        g.strokeStyle = lit > .3 && rimA > 0 ? rgba(rim, .5 * lit * rimA) : C.fur; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(px, py); g.lineTo(px + nx * sg * len + (r() - .5) * 4, py + ny * sg * len + (r() - .5) * 4); g.stroke();
      }
    }
    g.restore();
  }
}

// Кот в профиль (смотрит вправо). Единицы: длина ~260, высота ~190, начало — земля под центром
const CATSIDE = shape([-95, -60], [
  [-118, -62, -130, -92, -118, -114], [-96, -130, -30, -134, 40, -124],
  [56, -126, 62, -140, 64, -152], [67, -176], [76, -194], [86, -170],
  [92, -172], [101, -190], [106, -166],
  [118, -160, 126, -150, 130, -142], [134, -138],
  [130, -129, 120, -124, 110, -122], [98, -116, 88, -100, 86, -84],
  [80, -66, 60, -56, 40, -54], [0, -50, -50, -50, -95, -60]
], 31, 10);
const CATSIDE_EYE = [108, -150];

// Рисует идущего кота. phase — фаза шага (рад), state: {head:0..1 опущена, crouch}
function catWalk(x, y, s, phase, opt = {}) {
  const { light = [-.6, -1], rimA = 1, flip = 1, headDown = 0, tailUp = 1, eye = 1, glint = 0, bob = true } = opt;
  g.save(); g.translate(x, y); g.scale(flip * s, s);
  const b = bob ? -Math.abs(Math.sin(phase)) * 3 : 0;
  const L = [light[0] * flip, light[1]];
  // лапы: дальние, потом хвост, потом ближние (все под туловищем)
  const leg = (hx, a, bend, far) => {
    const kx = hx + Math.sin(a) * 34, ky = -60 + b + Math.cos(a) * 34 * .98;
    const px = kx + Math.sin(a - bend) * 34, py = ky + Math.cos(a - bend) * 30;
    limb([[hx, -70 + b], [kx, ky], [px, Math.min(py, 0)]], 17, 11, L, rimA * (far ? .35 : 1), C.goldHi, 0);
  };
  const sw = k => Math.sin(phase + k) * .42, bd = k => Math.max(0, Math.sin(phase + k + Math.PI / 2)) * .7;
  leg(52, sw(Math.PI), bd(Math.PI), true); leg(-88, sw(0), bd(0), true);
  // хвост пушистый
  const tw = Math.sin(phase * .5) * 10;
  const tail = []; for (let i = 0; i <= 14; i++) { const k = i / 14;
    tail.push([-112 - 50 * k - 12 * Math.sin(k * 3) , -104 + b - 110 * k * tailUp + Math.sin(k * 4 + phase * .5) * 8 + tw * k * k]); }
  limb(tail, 26, 18, L, rimA, C.goldHi, 6, 5);
  leg(66, sw(0), bd(0), false); leg(-76, sw(Math.PI), bd(Math.PI), false);
  // туловище с головой; наклон головы — поворот вокруг шеи
  g.save(); g.translate(0, b);
  if (headDown) { g.translate(60, -120); g.rotate(headDown * .28); g.translate(-60, 120); }
  fluffy(CATSIDE, 0, 0, 1, { light: L, rimA, fur: .55, glowA: .35, fluff: 1 });
  // глаз
  const [ex, ey] = CATSIDE_EYE;
  if (eye > 0) {
    g.save(); g.fillStyle = '#F2A83A'; g.beginPath(); g.ellipse(ex, ey, 6, 4 * eye, -.2, 0, 7); g.fill();
    g.fillStyle = '#050302'; g.beginPath(); g.ellipse(ex + 1, ey, 1.4, 3.6 * eye, 0, 0, 7); g.fill(); g.restore();
    glow(ex, ey, 22, C.amber, .45 * eye);
  }
  if (glint > 0) star4(ex + 3, ey - 3, 12, glint);
  // усы
  g.strokeStyle = rgba(C.goldHi, .35 * rimA); g.lineWidth = .8;
  for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(126, -134 + i * 2); g.quadraticCurveTo(150, -140 + i * 5, 170, -132 + i * 9); g.stroke(); }
  g.restore();
  g.restore();
}

/* ---------- дождь ---------- */
const RAIN = (() => { const r = rng(77); return Array.from({ length: 420 }, () => ({ x: r() * (W + 400) - 200, y: r() * H, l: 30 + r() * 60, v: 1500 + r() * 900, a: .08 + r() * .22, z: r() })); })();
function rain(t, a = 1, wind = .18) {
  if (a <= 0) return;
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  for (const d of RAIN) {
    const y = ((d.y + t * d.v) % (H + 200)) - 100, x = ((d.x + y * wind) % (W + 400) + W + 400) % (W + 400) - 200;
    g.strokeStyle = rgba(NIGHT.cool, d.a * a); g.lineWidth = .8 + d.z * 1.2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - wind * d.l, y - d.l); g.stroke();
  }
  g.restore();
}
const SPLASH = (() => { const r = rng(88); return Array.from({ length: 60 }, () => ({ x: r() * W, p: r(), dy: r() * 120 })); })();
function splashes(t, groundY, a = 1) {
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const s of SPLASH) {
    const k = (t * 1.7 + s.p) % 1, rr = 4 + k * 22;
    g.strokeStyle = rgba(NIGHT.cool, (1 - k) * .35 * a); g.lineWidth = 1;
    g.beginPath(); g.ellipse(s.x, groundY + s.dy, rr, rr * .22, 0, 0, 7); g.stroke();
  }
  g.restore();
}

/* ---------- Петербург: горизонт ---------- */
function skyline(t, a = 1) {
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, NIGHT.sky0); gr.addColorStop(.55, '#11151D'); gr.addColorStop(1, NIGHT.sky0);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // низкие облака, подсвеченные городом
  for (let i = 0; i < 7; i++) glow(100 + i * 160 + Math.sin(t * .1 + i) * 30, 520 + (i % 3) * 60, 260, '#3A2A1A', .35, 'source-over');
  const HOR = 1080; // линия воды
  const sil = '#07090D';
  g.fillStyle = sil;
  // крыши
  const rr = rng(4); let x = -20;
  while (x < W + 20) { const w = 60 + rr() * 110, h = 110 + rr() * 90; g.fillRect(x, HOR - h, w, h); if (rr() > .5) g.fillRect(x + w * .3, HOR - h - 24, 10, 24); x += w; }
  // Исаакий (слева)
  const ix = 250, iy = HOR - 190;
  g.fillRect(ix - 150, iy - 60, 300, 90);
  g.fillRect(ix - 95, iy - 130, 190, 80); // барабан
  g.beginPath(); g.ellipse(ix, iy - 130, 100, 105, 0, Math.PI, 0); g.fill(); // купол
  g.fillRect(ix - 14, iy - 270, 28, 40); g.fillRect(ix - 2, iy - 300, 4, 32);
  g.strokeStyle = rgba(C.gold, .22 * a); g.lineWidth = 1;
  for (let i = -8; i <= 8; i++) { g.beginPath(); g.moveTo(ix + i * 11, iy - 128); g.lineTo(ix + i * 11, iy - 58); g.stroke(); }
  g.beginPath(); g.ellipse(ix, iy - 130, 100, 105, 0, Math.PI * 1.08, Math.PI * 1.55); g.strokeStyle = rgba(C.goldHi, .35 * a); g.lineWidth = 2; g.stroke();
  // Адмиралтейство со шпилем (центр)
  const ax = 640; g.fillStyle = sil;
  g.fillRect(ax - 260, HOR - 150, 520, 150); g.fillRect(ax - 60, HOR - 250, 120, 100); g.fillRect(ax - 36, HOR - 330, 72, 80);
  g.beginPath(); g.moveTo(ax - 24, HOR - 330); g.lineTo(ax, HOR - 380); g.lineTo(ax + 24, HOR - 330); g.fill();
  const spireTop = HOR - 720;
  const sg = g.createLinearGradient(ax, spireTop, ax, HOR - 380);
  sg.addColorStop(0, rgba(C.goldHi, .95 * a)); sg.addColorStop(1, rgba(C.gold, .55 * a));
  g.fillStyle = sg; g.beginPath(); g.moveTo(ax - 8, HOR - 380); g.lineTo(ax, spireTop); g.lineTo(ax + 8, HOR - 380); g.fill();
  glow(ax, spireTop + 60, 90, C.goldHi, .35 * a * (.8 + .2 * Math.sin(t * 2)));
  star4(ax, spireTop - 6, 10, .8 * a);
  // Петропавловка (справа, далеко)
  const px = 960; g.fillStyle = '#090B10';
  g.fillRect(px - 40, HOR - 170, 80, 170); g.beginPath(); g.moveTo(px - 10, HOR - 170); g.lineTo(px, HOR - 560); g.lineTo(px + 10, HOR - 170); g.fill();
  g.strokeStyle = rgba(C.gold, .4 * a); g.lineWidth = 1.2; g.beginPath(); g.moveTo(px, HOR - 560); g.lineTo(px, HOR - 330); g.stroke();
  // окна
  const wr = rng(12);
  for (let i = 0; i < 120; i++) { const wx = wr() * W, wy = HOR - 20 - wr() * 150; if (wr() > .55) { g.fillStyle = rgba(NIGHT.lamp, .25 + wr() * .5); g.fillRect(wx, wy, 4, 6); } }
  // вода
  const wg = g.createLinearGradient(0, HOR, 0, H); wg.addColorStop(0, '#0B0F16'); wg.addColorStop(1, '#040507');
  g.fillStyle = wg; g.fillRect(0, HOR, W, H - HOR);
  // отражения: шпиль и фонари дрожат в воде
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let yy = HOR + 4; yy < HOR + 520; yy += 6) {
    const k = (yy - HOR) / 520, wob = Math.sin(yy * .09 + t * 3) * (4 + k * 18);
    g.fillStyle = rgba(C.goldHi, .28 * (1 - k) * a); g.fillRect(ax - 3 + wob, yy, 6 + k * 10, 3);
    for (const lx of [120, 420, 860]) { g.fillStyle = rgba(NIGHT.lamp, .18 * (1 - k) * a); g.fillRect(lx + wob * 1.3, yy, 8 + k * 14, 3); }
  }
  g.restore();
  // набережная: гранитный парапет и фонари
  g.fillStyle = '#0A0C10'; g.fillRect(0, 1560, W, 360);
  g.fillStyle = '#12151B'; g.fillRect(0, 1560, W, 14);
  for (const lx of [120, 420, 860]) streetLamp(lx, 1560, 1, a, t);
}
function streetLamp(x, base, s = 1, a = 1, t = 0) {
  g.save(); g.fillStyle = '#0B0D11'; g.strokeStyle = rgba(C.gold, .35 * a); g.lineWidth = 1.2;
  g.fillRect(x - 6 * s, base - 300 * s, 12 * s, 300 * s);
  g.beginPath(); g.moveTo(x, base - 300 * s); g.quadraticCurveTo(x + 40 * s, base - 330 * s, x + 60 * s, base - 300 * s); g.stroke();
  g.beginPath(); g.moveTo(x, base - 300 * s); g.quadraticCurveTo(x - 40 * s, base - 330 * s, x - 60 * s, base - 300 * s); g.stroke();
  g.restore();
  const fl = .9 + .1 * Math.sin(t * 13 + x);
  for (const dx of [-60, 0, 60]) { const ly = base - (dx ? 290 : 335) * s;
    g.fillStyle = rgba('#FFE2A8', .9 * a); g.beginPath(); g.arc(x + dx * s, ly, 9 * s, 0, 7); g.fill();
    glow(x + dx * s, ly, 110 * s, NIGHT.lamp, .5 * a * fl); }
}

/* ---------- улица ---------- */
const STREET = { ground: 1520, doors: { A: 760, B: 1760, C: 2760, T: 3900 } };
const FACADES = (() => { const r = rng(55), out = []; let x = -600;
  while (x < 5200) { const w = 520 + r() * 380; out.push({ x, w, h: 1150 + r() * 250, tone: r(), win: rng(Math.floor(r() * 1000)) }); x += w + 6; }
  return out; })();
function street(t, camX, a = 1, lightsOff = {}) {
  const G = STREET.ground;
  const sky = g.createLinearGradient(0, 0, 0, G); sky.addColorStop(0, NIGHT.sky0); sky.addColorStop(1, '#0D1016');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  g.save(); g.translate(-camX, 0);
  for (const f of FACADES) {
    if (f.x + f.w < camX - 50 || f.x > camX + W + 50) continue;
    const top = G - f.h;
    g.fillStyle = f.tone > .5 ? '#0C0F14' : '#0A0D12'; g.fillRect(f.x, top, f.w, f.h);
    // карниз и рустовка первого этажа
    g.fillStyle = '#131720'; g.fillRect(f.x - 8, top, f.w + 16, 18); g.fillRect(f.x, G - 300, f.w, 10);
    g.strokeStyle = rgba(C.gold, .06); g.lineWidth = 1;
    for (let yy = G - 290; yy < G; yy += 34) { g.beginPath(); g.moveTo(f.x, yy); g.lineTo(f.x + f.w, yy); g.stroke(); }
    // окна
    const r = rng(Math.floor(f.x) + 9);
    for (let row = 0; row < 5; row++) for (let col = 0; col < Math.floor(f.w / 110); col++) {
      const wx = f.x + 40 + col * 110, wy = top + 90 + row * 170;
      if (wy > G - 380) continue;
      const lit = r() > .62;
      g.fillStyle = lit ? rgba(NIGHT.lamp, .55 + r() * .3) : '#07090C'; g.fillRect(wx, wy, 52, 96);
      g.fillStyle = '#131720'; g.fillRect(wx - 6, wy - 12, 64, 8);
      if (lit) glow(wx + 26, wy + 48, 70, NIGHT.warm, .12);
    }
  }
  // двери A, B, C
  door(STREET.doors.A, G, 'cafe', t, lightsOff.A);
  door(STREET.doors.B, G, 'entrance', t, lightsOff.B);
  door(STREET.doors.C, G, 'shop', t, lightsOff.C);
  taina(STREET.doors.T, G, t, 0);
  for (let lx = 300; lx < 4600; lx += 1000) streetLamp(lx, G + 40, .9, a, t);
  g.restore();
  // мокрый тротуар с отражениями
  const pg = g.createLinearGradient(0, G, 0, H); pg.addColorStop(0, '#101318'); pg.addColorStop(1, '#050608');
  g.fillStyle = pg; g.fillRect(0, G, W, H - G);
  g.save(); g.globalAlpha = .22; g.translate(0, G * 2); g.scale(1, -1); g.filter = 'blur(6px)';
  g.drawImage(cv, 0, G - 420, W, 420, 0, G - 420, W, 420); g.restore();
  g.fillStyle = '#1A1E26'; g.fillRect(0, G, W, 3);
}
function door(x, G, kind, t, open = 0) { // open: 0 закрыта, >0 открыта (свет изнутри)
  const w = 190, h = 360, x0 = x - w / 2, y0 = G - h;
  g.fillStyle = '#07080B'; g.fillRect(x0 - 16, y0 - 16, w + 32, h + 16);
  g.strokeStyle = rgba(C.gold, .25); g.lineWidth = 2; g.strokeRect(x0 - 16, y0 - 16, w + 32, h + 16);
  if (open > 0) {
    const gr = g.createLinearGradient(0, y0, 0, G); gr.addColorStop(0, rgba('#FFD9A0', .9 * open)); gr.addColorStop(1, rgba('#FF9A40', .7 * open));
    g.fillStyle = gr; g.fillRect(x0, y0, w, h);
    g.save(); g.globalCompositeOperation = 'lighter';
    const sp = g.createLinearGradient(0, G, 0, G + 260); sp.addColorStop(0, rgba('#FFB060', .45 * open)); sp.addColorStop(1, rgba('#FFB060', 0));
    g.fillStyle = sp; g.beginPath(); g.moveTo(x0, G); g.lineTo(x0 + w, G); g.lineTo(x0 + w + 160, G + 260); g.lineTo(x0 - 160, G + 260); g.closePath(); g.fill(); g.restore();
    // створка распахнута
    g.fillStyle = '#0B0C10'; g.beginPath(); g.moveTo(x0 + w, y0); g.lineTo(x0 + w + 60 * open, y0 + 20); g.lineTo(x0 + w + 60 * open, G - 10); g.lineTo(x0 + w, G); g.fill();
  } else {
    g.fillStyle = '#0D0F14'; g.fillRect(x0, y0, w, h);
    g.strokeStyle = rgba(C.gold, .18); g.strokeRect(x0 + 20, y0 + 20, w - 40, h * .45); g.strokeRect(x0 + 20, y0 + h * .55, w - 40, h * .38);
  }
  // вывески
  const label = { cafe: 'КОФЕ', entrance: '12', shop: 'ЛАВКА' }[kind];
  text(label, x, y0 - 60, kind === 'entrance' ? 44 : 40, open > 0 || kind === 'entrance' ? C.goldHi : rgba(C.goldHi, .45), 1, { caps: true, ls: 8, weight: 600, glowA: .5 });
  if (kind === 'cafe' || kind === 'shop') { // витрина
    const on = kind === 'shop' ? 1 - (open < 0 ? 1 : 0) : 1;
    g.fillStyle = rgba(NIGHT.lamp, .35 * on); g.fillRect(x0 - 230, y0 + 40, 180, 200); glow(x0 - 140, y0 + 140, 180, NIGHT.warm, .25 * on);
  }
}
// Дверь TAINA: стрельчатая арка, золотая кайма, красный ромб, табличка
function taina(x, G, t, open = 0, s = 1) {
  const w = 230 * s, h = 470 * s, top = G - h;
  g.fillStyle = '#0A0706';
  g.beginPath(); g.moveTo(x - w / 2, G); g.lineTo(x - w / 2, top + w * .55); g.quadraticCurveTo(x - w / 2, top, x, top - 30 * s); g.quadraticCurveTo(x + w / 2, top, x + w / 2, top + w * .55); g.lineTo(x + w / 2, G); g.closePath(); g.fill();
  if (open > 0) {
    g.save(); g.clip();
    const gr = g.createLinearGradient(0, top, 0, G); gr.addColorStop(0, rgba('#FFE3B0', open)); gr.addColorStop(1, rgba('#FFB25A', open));
    g.fillStyle = gr; g.fillRect(x - w, top - 60, w * 2, h + 80); g.restore();
    g.save(); g.globalCompositeOperation = 'lighter';
    const sp = g.createLinearGradient(0, G, 0, G + 360 * s); sp.addColorStop(0, rgba('#FFB060', .55 * open)); sp.addColorStop(1, rgba('#FFB060', 0));
    g.fillStyle = sp; g.beginPath(); g.moveTo(x - w / 2, G); g.lineTo(x + w / 2, G); g.lineTo(x + w / 2 + 260 * s, G + 360 * s); g.lineTo(x - w / 2 - 260 * s, G + 360 * s); g.closePath(); g.fill(); g.restore();
    glow(x, G - h / 2, 700 * s, NIGHT.warm, .35 * open);
  } else {
    g.strokeStyle = rgba(C.gold, .22); g.lineWidth = 1.4;
    for (const k of [-.25, .25]) { g.beginPath(); g.moveTo(x + k * w, G - 20); g.lineTo(x + k * w, top + 80 * s); g.stroke(); }
    g.fillStyle = rgba('#FFB25A', .5); g.fillRect(x - w / 2 + 6, G - 4, w - 12, 4); // свет под дверью
  }
  arch(x, G, top - 30 * s, w / 2, 1, 1, 2.2);
  gem(x, top - 95 * s, 44 * s, 76 * s, .95);
  flare(x, top - 95 * s, 160 * s, .35 + .1 * Math.sin(t * 2));
  // табличка
  g.fillStyle = '#0B0806'; g.fillRect(x + w / 2 + 30 * s, G - 300 * s, 150 * s, 60 * s);
  g.strokeStyle = rgba(C.gold, .6); g.lineWidth = 1.2; g.strokeRect(x + w / 2 + 30 * s, G - 300 * s, 150 * s, 60 * s);
  text('TAINA', x + w / 2 + 105 * s, G - 270 * s, 32 * s, C.goldHi, 1, { caps: true, ls: 6, weight: 600, glowA: .6 });
}

/* ---------- люди (силуэты) ---------- */
// Прохожий в дверях, смотрит влево; рука с метлой рисуется отдельно (shooer())
const SHOOER = shape([-36, 0], [
  [-40, -230], [-34, -270], [-14, -292], [-30, -300, -30, -350, 0, -352], [28, -350, 30, -306, 12, -292],
  [30, -272], [36, -150], [36, 0]
], 41, 8);
function shooer(x, G, s, a, t, wave = 0) {
  if (a <= 0) return;
  silhouette(SHOOER, x, G, s, { light: [1, -.2], rim: '#FFC27A', rimA: a, fur: 0, glowA: .35 });
  const sx = x - 30 * s, sy = G - 262 * s, an = Math.sin(t * 14) * .25 * wave;
  const hx = sx - 130 * s * Math.cos(an), hy = sy - 130 * s * Math.sin(an) + 10 * s;
  limb([[sx, sy], [lerp(sx, hx, .5), lerp(sy, hy, .5) + 8 * s], [hx, hy]], 18 * s, 13 * s, [.3, -1], a, '#FFC27A');
  // метла
  g.save(); g.strokeStyle = C.fur; g.lineWidth = 7 * s; g.beginPath(); g.moveTo(hx + 20 * s, hy - 60 * s); g.lineTo(hx - 30 * s, hy + 150 * s); g.stroke();
  g.strokeStyle = rgba('#FFC27A', .5 * a); g.lineWidth = 2;
  for (let i = -5; i <= 5; i++) { g.beginPath(); g.moveTo(hx - 30 * s, hy + 150 * s); g.lineTo(hx - 30 * s + i * 7 * s, hy + 215 * s); g.stroke(); }
  g.restore();
}
// Маргарита: длинные волосы, платье в пол, смотрит вниз на кота
const MARGO = shape([-70, 0], [
  [-58, -120, -40, -220, -38, -270], [-46, -300, -52, -330, -50, -360],
  [-54, -392, -40, -420, -14, -424], [10, -426, 24, -410, 26, -392], [30, -380], [26, -374],
  [22, -360, 18, -352, 12, -348], [22, -330], [28, -300, 30, -260, 26, -230],
  [40, -150, 60, -60, 72, 0], [-70, 0]
], 43, 8);
// Гость: плащ, шляпа, зонт в руке, стопка бумаг
const GUEST = shape([-44, 0], [
  [-50, -150], [-54, -260], [-44, -300], [-30, -312], [-58, -318], [-58, -330], [-26, -334],
  [-20, -362], [18, -362], [22, -334], [50, -330], [50, -318], [24, -312],
  [34, -300], [50, -260], [56, -150], [48, 0]
], 47, 6);
function person(S, x, y, s, light, rimA, rim = '#FFC27A') {
  silhouette(S, x, y, s, { light, rim, rimA, fur: 0, glowA: .35 });
}

/* ---------- студия ---------- */
function filmCamera(x, y, s, a = 1, t = 0) { // кинокамера на штативе
  g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha = a;
  g.strokeStyle = rgba(C.gold, .6); g.lineWidth = 3; g.fillStyle = '#0C0908';
  for (const dx of [-90, 0, 90]) { g.beginPath(); g.moveTo(0, -260); g.lineTo(dx, 0); g.stroke(); }
  g.fillRect(-110, -380, 200, 120); g.strokeRect(-110, -380, 200, 120);
  g.fillRect(90, -350, 70, 60); g.strokeRect(90, -350, 70, 60); // объектив
  for (const [rx, ry] of [[-60, -450], [40, -450]]) {
    g.save(); g.translate(rx, ry); g.rotate(t * (rx < 0 ? 1.2 : -1.2));
    g.beginPath(); g.arc(0, 0, 62, 0, 7); g.fill(); g.stroke();
    for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(Math.cos(i * 1.256) * 34, Math.sin(i * 1.256) * 34, 12, 0, 7); g.stroke(); }
    g.restore();
  }
  g.restore();
  glow(x + 125 * s, y - 320 * s, 60 * s, C.goldHi, .25 * a);
}
function lightStand(x, y, s, a = 1, on = 1) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.strokeStyle = rgba(C.gold, .5 * a); g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -520); g.moveTo(-70, 0); g.lineTo(0, -80); g.lineTo(70, 0); g.stroke();
  g.fillStyle = '#0C0908'; g.beginPath(); g.moveTo(-110, -640); g.lineTo(110, -640); g.lineTo(60, -520); g.lineTo(-60, -520); g.closePath(); g.fill(); g.stroke();
  g.restore();
  if (on > 0) { glow(x, y - 600 * s, 380 * s, '#FFD9A0', .35 * on * a);
    g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createLinearGradient(0, y - 560 * s, 0, y + 200); gr.addColorStop(0, rgba('#FFD9A0', .18 * on * a)); gr.addColorStop(1, rgba('#FFD9A0', 0));
    g.fillStyle = gr; g.beginPath(); g.moveTo(x - 70 * s, y - 560 * s); g.lineTo(x + 70 * s, y - 560 * s); g.lineTo(x + 380 * s, y + 200); g.lineTo(x - 380 * s, y + 200); g.closePath(); g.fill(); g.restore(); }
}
function clapper(x, y, s, a = 1) {
  g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha = a;
  g.fillStyle = '#0C0908'; g.fillRect(-90, -60, 180, 110); g.strokeStyle = rgba(C.gold, .6); g.lineWidth = 2; g.strokeRect(-90, -60, 180, 110);
  g.save(); g.translate(-90, -60); g.rotate(-.25); g.fillRect(0, -26, 184, 26); g.strokeRect(0, -26, 184, 26);
  g.fillStyle = rgba(C.goldHi, .8); for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(8 + i * 30, 0); g.lineTo(22 + i * 30, 0); g.lineTo(36 + i * 30, -26); g.lineTo(22 + i * 30, -26); g.fill(); }
  g.restore(); g.restore();
  text('TAINA · сцена 1', x, y - 10 * s, 26 * s, C.goldHi, a, { weight: 600, glowA: .2 });
}
// Горы бумаг
const PILE = (() => { const r = rng(61); return Array.from({ length: 150 }, () => ({ x: r(), y: r(), rot: r() * 6.28, w: 40 + r() * 60, lit: .4 + r() * .6 })); })();
const PILE_CACHE = {};
function paperPile(cx, base, wid, hgt, a = 1, order = 1) {
  // Гора статична: рисуем один раз в отдельный слой (размытие листов дорогое), дальше только накладываем
  const key = [cx, base, wid, hgt].join(':');
  if (!PILE_CACHE[key]) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const saved = g; g = c.getContext('2d');
    for (const p of PILE) {
      const px = cx + (p.x - .5) * wid * (1 - p.y * .6), py = base - p.y * hgt * (1 - Math.abs(p.x - .5) * 1.2);
      if (py > base + 5) continue;
      paperQuad(px, py, p.w, p.rot, 1, p.lit, p.y < .5 ? 1 : 0);
    }
    g = saved; PILE_CACHE[key] = c;
  }
  if (a * order <= 0) return;
  g.save(); g.globalAlpha = a * order; g.drawImage(PILE_CACHE[key], 0, 0); g.restore();
}
// Стена-библиотека в форме арки: fill 0..1 — сколько ячеек заполнено
const SHELF = { x: 540, base: 1400, top: 360, half: 380, rows: 9, cols: 7 };
function shelfWall(fill, t, a = 1, hotIdx = -1, hot = 0) {
  const { x, base, top, half, rows, cols } = SHELF;
  arch(x, base, top, half, 1, a, 2.4);
  arch(x, base, top + 40, half - 34, 1, a * .45, 1.2);
  const cellH = (base - top - 330) / rows, cellW = (half * 2 - 90) / cols;
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push([x - half + 45 + c * cellW, top + 300 + r * cellH]);
  g.save(); g.globalAlpha = a;
  for (let r = 0; r <= rows; r++) { g.strokeStyle = rgba(C.gold, .3); g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - half + 40, top + 300 + r * cellH); g.lineTo(x + half - 40, top + 300 + r * cellH); g.stroke(); }
  g.restore();
  const n = Math.floor(fill * cells.length);
  cells.forEach(([cx, cy], i) => {
    if (i >= n) return;
    const k = clamp(fill * cells.length - i);
    for (let j = 0; j < 4; j++) {
      const bw = cellW / 5, bx = cx + 6 + j * (bw + 3), bh = cellH * (.62 + ((i * 7 + j * 3) % 5) * .06);
      g.fillStyle = `rgba(${200 + j * 10},${150 + j * 12},${90 + j * 8},${.75 * k * a})`; g.fillRect(bx, cy + cellH - bh - 2, bw, bh);
    }
    glow(cx + cellW / 2, cy + cellH / 2, cellW * .7, NIGHT.warm, .12 * k * a);
    if (i === hotIdx && hot > 0) { glow(cx + cellW / 2, cy + cellH / 2, cellW * 1.4, C.red, .7 * hot); star4(cx + cellW / 2, cy + cellH / 2, 16, hot); }
  });
  return cells;
}

/* ---------- субтитры и титры ---------- */
function sub(t, t0, t1, who, line, y = 1700) {
  const a = bell(t, t0, t1, .3, .3);
  if (a <= 0) return;
  const gr = g.createLinearGradient(0, y - 180, 0, y + 200); gr.addColorStop(0, rgba('#000000', 0)); gr.addColorStop(.4, rgba('#000000', .55 * a)); gr.addColorStop(1, rgba('#000000', .7 * a));
  g.fillStyle = gr; g.fillRect(0, y - 180, W, 380);
  if (who) text(who, W / 2, y - 64, 30, C.gold, a, { caps: true, ls: 10, weight: 600, glowA: .2 });
  const lines = line.split('\n');
  lines.forEach((l, i) => text(l, W / 2, y + i * 66, 58, C.ink, a, { italic: true, glowA: .3 }));
}
function shout(t, t0, t1, str, x, y) {
  const a = bell(t, t0, t1, .08, .3);
  if (a <= 0) return;
  const sh = (1 - seg(t, t0, t0 + .4)) * 10;
  text(str, x + Math.sin(t * 70) * sh, y, 120, C.ember || '#E8722E', a, { weight: 600, glowA: .7 });
}
function titleCard(t, t0, t1, series, name) {
  const a = bell(t, t0, t1, .8, .7);
  if (a <= 0) return;
  goldWord('БЕГЕМОТ', 760, 170, 14, a, seg(t, t0 + .2, t0 + 2));
  divider(870, 200, seg(t, t0 + .4, t0 + 1.3), a);
  text(`Серия ${series} · ${name}`, W / 2, 950, 56, C.ink, a, { italic: true });
}
function endCard(t, t0, series, name, tail = 'Продолжение следует') {
  const a = seg(t, t0, t0 + .8);
  if (a <= 0) return;
  g.fillStyle = rgba(C.void, a); g.fillRect(0, 0, W, H);
  gem(540, 600, 90 * a + 1, 160 * a + 1, a); flare(540, 600, 360, bell(t, t0 + .3, t0 + 2, .3, .9) * .8);
  goldWord('БЕГЕМОТ', 860, 160, 14, a, seg(t, t0 + .3, t0 + 2));
  text(`Серия ${series} · ${name}`, W / 2, 1000, 56, C.ink, seg(t, t0 + .6, t0 + 1.3), { italic: true });
  divider(1100, 220, seg(t, t0 + .8, t0 + 1.6), 1);
  text(tail, W / 2, 1190, 44, C.goldHi, seg(t, t0 + 1.1, t0 + 1.8), { caps: true, ls: 8, weight: 600, glowA: .4 });
  text('TAINA', W / 2, 1720, 40, C.gold, seg(t, t0 + 1.4, t0 + 2), { caps: true, ls: 16, weight: 600, glowA: .3 });
}

/* ---------- кадр ---------- */
function render(t) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
  g.fillStyle = C.void; g.fillRect(0, 0, W, H);
  EP.scene(t);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = .14;
  g.drawImage(grains[Math.floor(t * 24) % 4], 0, 0, W, H);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  const vg = g.createRadialGradient(W / 2, H / 2, W * .45, W / 2, H / 2, H * .75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  if (t < .6) { g.fillStyle = rgba(C.void, 1 - seg(t, 0, .6)); g.fillRect(0, 0, W, H); }
  if (t > EP.dur - .5) { g.fillStyle = rgba(C.void, seg(t, EP.dur - .5, EP.dur)); g.fillRect(0, 0, W, H); }
}
