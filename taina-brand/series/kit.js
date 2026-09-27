// Общий набор кисти TAINA: силуэты с контровым светом, ромб, вспышки, орнаменты, частицы.
// Кадр 1080×1920; сцены — в scenes.js.
const W = 1080, H = 1920, DUR = 30;
window.FILM = { w: W, h: H, dur: DUR };
const cv = document.getElementById('c'); cv.width = W; cv.height = H;
const g = cv.getContext('2d');

const C = { void:'#040304', gold:'#C9974A', goldHi:'#F2CF8A', goldDk:'#6B4A1E', red:'#D0141C', ink:'#EFE6D6', amber:'#F0A83A', fur:'#050404' };
const SERIF = '"Cormorant Garamond", Georgia, serif';

function rng(seed){ return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eo = x => 1 - Math.pow(1 - x, 3);
const ei = x => x * x * x;
const bell = (t, a, b, fi = .4, fo = .4) => Math.min(seg(t, a, a + fi), 1 - seg(t, b - fo, b));
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; };

/* ---------- силуэты: контур из кривых → точки, нормали, «мех» ---------- */
function shape(start, segs, seed, n = 14) {
  const pts = []; let [px, py] = start; pts.push([px, py]);
  for (const s of segs) {
    if (s.length === 2) { for (let i = 1; i <= n; i++) { const k = i / n; pts.push([lerp(px, s[0], k), lerp(py, s[1], k)]); } [px, py] = s; }
    else {
      const [ax, ay, bx, by, x, y] = s;
      for (let i = 1; i <= n * 2; i++) { const k = i / (n * 2), u = 1 - k;
        pts.push([u*u*u*px + 3*u*u*k*ax + 3*u*k*k*bx + k*k*k*x, u*u*u*py + 3*u*u*k*ay + 3*u*k*k*by + k*k*k*y]); }
      [px, py] = [x, y];
    }
  }
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const r = rng(seed), m = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + m) % m], b = pts[(i + 1) % m];
    let nx = b[1] - a[1], ny = -(b[0] - a[0]); const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    if (nx * (p[0] - cx) + ny * (p[1] - cy) < 0) { nx = -nx; ny = -ny; }
    return { x: p[0], y: p[1], nx, ny, r1: r(), r2: r(), r3: r() };
  });
}
// Силуэт с контровым светом. light — направление К источнику света
function silhouette(S, x, y, s, { light = [1, -.4], rim = C.goldHi, rimA = 1, fur = 1, glowA = .5, fill = C.fur } = {}) {
  const [lx0, ly0] = light, ll = Math.hypot(lx0, ly0), lx = lx0 / ll, ly = ly0 / ll;
  const P = S.map(p => ({ ...p, X: x + p.x * s, Y: y + p.y * s, f: Math.max(0, p.nx * lx + p.ny * ly) }));
  const poly = () => { g.beginPath(); P.forEach((p, i) => i ? g.lineTo(p.X, p.Y) : g.moveTo(p.X, p.Y)); g.closePath(); };
  if (glowA > 0 && rimA > 0) { g.save(); g.shadowColor = rgba(rim, glowA * rimA); g.shadowBlur = 60; g.shadowOffsetX = lx * 10; g.shadowOffsetY = ly * 10; g.fillStyle = fill; poly(); g.fill(); g.restore(); }
  g.fillStyle = fill; poly(); g.fill();
  if (rimA <= 0) return P;
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  for (let i = 0; i < P.length; i++) {
    const p = P[i], q = P[(i + 1) % P.length], f = (p.f + q.f) / 2;
    if (f < .05) continue;
    g.strokeStyle = rgba(rim, rimA * Math.pow(f, 1.4)); g.lineWidth = 1.2 + 2.4 * f;
    g.beginPath(); g.moveTo(p.X, p.Y); g.lineTo(q.X, q.Y); g.stroke();
  }
  if (fur > 0) for (const p of P) {
    if (p.f < .12) continue;
    for (const [rr, off] of [[p.r1, 0], [p.r2, .5]]) {
      const len = (5 + 14 * rr) * fur, ang = Math.atan2(p.ny, p.nx) + (p.r3 - .5) * .9 + off * (rr - .5);
      g.strokeStyle = rgba(rim, rimA * p.f * (.25 + .45 * rr)); g.lineWidth = .8 + rr * .6;
      g.beginPath(); g.moveTo(p.X - p.nx * 3, p.Y - p.ny * 3); g.lineTo(p.X + Math.cos(ang) * len, p.Y + Math.sin(ang) * len); g.stroke();
    }
  }
  g.restore();
  return P;
}

// Кот сидит анфас. Единицы: ширина ~190, высота 300, начало — середина низа
const CAT = shape([-70, 0], [
  [-96, -40, -94, -92, -78, -122], [-66, -150, -54, -162, -47, -176], [-60, -186, -66, -198, -64, -210],
  [-62, -226, -60, -238, -56, -248], [-54, -266, -52, -282, -49, -296], [-40, -284, -30, -270, -22, -259],
  [-12, -263, 12, -263, 22, -259], [30, -270, 40, -284, 49, -296], [52, -282, 54, -266, 56, -248],
  [60, -238, 62, -226, 64, -210], [66, -198, 60, -186, 47, -176], [54, -162, 66, -150, 78, -122],
  [94, -92, 96, -40, 70, 0], [30, 4, -30, 4, -70, 0]
], 7);
const TAIL = (() => { // хвост — трубка вокруг кривой
  const c = [], w = k => lerp(13, 7, k);
  for (let i = 0; i <= 30; i++) { const k = i / 30, u = 1 - k;
    c.push([u*u*u*62 + 3*u*u*k*120 + 3*u*k*k*90 + k*k*k*-20, u*u*u*-12 + 3*u*u*k*-6 + 3*u*k*k*22 + k*k*k*10]); }
  const L = [], R = [];
  c.forEach((p, i) => { const a = c[Math.max(0, i - 1)], b = c[Math.min(c.length - 1, i + 1)]; let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const l = Math.hypot(nx, ny); nx /= l; ny /= l;
    L.push([p[0] + nx * w(i / 30), p[1] + ny * w(i / 30)]); R.push([p[0] - nx * w(i / 30), p[1] - ny * w(i / 30)]); });
  const all = [...L, ...R.reverse()];
  return shape(all[0], all.slice(1).map(p => [p[0], p[1]]), 17, 2);
})();
const CAT_EYES = [[-24, -222], [24, -222]];

// Девушка сидит на полу в профиль (смотрит вправо), держит лист
const GIRL = shape([-52, 0], [
  [-68, -40, -74, -96, -60, -126], [-55, -136, -50, -141, -44, -146],
  [-52, -150, -60, -162, -54, -172], [-48, -184, -34, -186, -28, -178],
  [-20, -190, 2, -192, 12, -180], [19, -172, 22, -162, 24, -153], [29, -149], [25, -145],
  [26, -140, 20, -133, 11, -132], [3, -127],
  [20, -112, 38, -100, 56, -92], [67, -92],
  [77, -88, 87, -72, 87, -58], [87, -40, 83, -14, 79, -5], [95, -3], [95, 0], [-52, 0]
], 23);

function catFace(x, y, s, open, pupil, a = 1, glint = 0) {
  if (a <= 0) return;
  for (const [ex, ey] of CAT_EYES) {
    const X = x + ex * s, Y = y + ey * s, w = 11 * s, h = 7.2 * s * open;
    if (open > .02) {
      g.save(); g.globalAlpha = a;
      g.beginPath(); g.moveTo(X - w, Y + 1 * s); g.quadraticCurveTo(X, Y - h * 1.35, X + w, Y - 1 * s); g.quadraticCurveTo(X, Y + h * 1.35, X - w, Y + 1 * s); g.closePath();
      const gr = g.createRadialGradient(X, Y, 0, X, Y, w);
      gr.addColorStop(0, '#FFE08A'); gr.addColorStop(.45, '#F2A83A'); gr.addColorStop(1, '#6A3A06');
      g.fillStyle = gr; g.fill(); g.clip();
      g.fillStyle = '#050302'; g.beginPath(); g.ellipse(X, Y, w * lerp(.14, 1.2, pupil), h * 1.5, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,250,235,.9)'; g.beginPath(); g.arc(X + w * .32, Y - h * .35, Math.max(1.2, s * 1.4), 0, 7); g.fill();
      g.restore();
      glow(X, Y, w * 3.2, C.amber, .28 * a * open);
    }
    if (glint > 0) star4(X + w * .3, Y - h * .4, 9 * s * .35 + 10, glint);
  }
  // нос и усы
  g.save(); g.globalAlpha = a * .5; g.strokeStyle = rgba(C.goldHi, .5); g.lineWidth = Math.max(.6, s * .18);
  for (const sgn of [-1, 1]) for (let i = 0; i < 3; i++) {
    g.beginPath(); g.moveTo(x + sgn * 8 * s, y - 202 * s + i * 2 * s);
    g.quadraticCurveTo(x + sgn * 30 * s, y - (204 - i * 3) * s, x + sgn * (52 + i * 4) * s, y - (198 - i * 7) * s); g.stroke();
  }
  g.restore();
}

/* ---------- примитивы ---------- */
function glow(x, y, r, color, a, mode = 'lighter') {
  if (a <= 0 || r <= 0) return;
  g.save(); g.globalCompositeOperation = mode;
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgba(color, a)); gr.addColorStop(.35, rgba(color, a * .28)); gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.restore();
}
function gem(x, y, w, h, a) {
  if (a <= 0) return;
  glow(x, y, h * 1.6, C.red, .55 * a);
  glow(x, y, h * .7, '#FF5A3C', .35 * a);
  g.save(); g.globalAlpha = a; g.translate(x, y);
  const T = [0, -h / 2], R = [w / 2, 0], B = [0, h / 2], L = [-w / 2, 0], O = [w * .06, -h * .04];
  const tri = (p, q, r, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(...p); g.lineTo(...q); g.lineTo(...r); g.closePath(); g.fill(); };
  tri(T, L, O, '#E3372C'); tri(T, R, O, '#A8121A'); tri(L, B, O, '#7E0B10'); tri(R, B, O, '#3E0406');
  const sh = g.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  sh.addColorStop(0, 'rgba(255,190,150,.35)'); sh.addColorStop(.45, 'rgba(255,120,90,0)');
  g.fillStyle = sh; g.beginPath(); g.moveTo(...T); g.lineTo(...R); g.lineTo(...B); g.lineTo(...L); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(255,150,110,.9)'; g.lineWidth = Math.max(1, w * .012);
  g.beginPath(); g.moveTo(...T); g.lineTo(...R); g.lineTo(...B); g.lineTo(...L); g.closePath(); g.stroke();
  g.strokeStyle = 'rgba(255,170,130,.35)'; g.lineWidth = Math.max(.6, w * .006);
  g.beginPath(); g.moveTo(...T); g.lineTo(...O); g.lineTo(...B); g.moveTo(...L); g.lineTo(...O); g.lineTo(...R); g.stroke();
  g.restore();
}
function flare(x, y, len, a, color = '#FF6A48') {
  if (a <= 0) return;
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const [dx, dy, l, th] of [[1, 0, len, 3], [0, 1, len * .7, 2.4], [.7, .7, len * .22, 1.2], [.7, -.7, len * .22, 1.2]]) {
    const gr = g.createLinearGradient(x - dx * l, y - dy * l, x + dx * l, y + dy * l);
    gr.addColorStop(0, rgba(color, 0)); gr.addColorStop(.5, rgba('#FFE2C8', .9 * a)); gr.addColorStop(1, rgba(color, 0));
    g.strokeStyle = gr; g.lineWidth = th; g.beginPath(); g.moveTo(x - dx * l, y - dy * l); g.lineTo(x + dx * l, y + dy * l); g.stroke();
  }
  g.restore();
  glow(x, y, len * .25, color, .6 * a);
}
function star4(x, y, r, a, color = C.goldHi) {
  if (a <= 0) return;
  g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = rgba(color, a); g.translate(x, y);
  g.beginPath(); g.moveTo(0, -r); g.quadraticCurveTo(0, 0, r * .9, 0); g.quadraticCurveTo(0, 0, 0, r); g.quadraticCurveTo(0, 0, -r * .9, 0); g.quadraticCurveTo(0, 0, 0, -r); g.fill();
  g.restore(); glow(x, y, r * 1.6, color, .4 * a);
}
function text(str, x, y, size, color, a, { italic = false, weight = 500, ls = 0, caps = false, glowA = .35 } = {}) {
  if (a <= 0) return;
  g.save(); g.globalAlpha = a;
  g.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${SERIF}`; g.letterSpacing = ls + 'px';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color;
  g.shadowColor = rgba(C.gold, glowA); g.shadowBlur = size * .45;
  g.fillText(caps ? str.toUpperCase() : str, x + ls / 2, y);
  g.restore();
}
function divider(y, half, p, a) {
  if (p <= 0 || a <= 0) return;
  const cx = W / 2, l = half * eo(p);
  g.save(); g.globalAlpha = a;
  const gr = g.createLinearGradient(cx - l, 0, cx + l, 0);
  gr.addColorStop(0, rgba(C.gold, 0)); gr.addColorStop(.5, rgba(C.goldHi, .95)); gr.addColorStop(1, rgba(C.gold, 0));
  g.strokeStyle = gr; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx - l, y); g.lineTo(cx + l, y); g.stroke();
  g.fillStyle = C.goldHi; g.translate(cx, y); g.rotate(Math.PI / 4); const d = 8 * eo(seg(p, .2, .7)); g.fillRect(-d / 2, -d / 2, d, d);
  g.restore();
  for (const k of [-.55, .55]) { g.fillStyle = rgba(C.goldHi, a * seg(p, .5, 1)); g.beginPath(); g.arc(cx + k * half, y, 2.4, 0, 7); g.fill(); }
  for (const k of [-.3, .3]) star4(cx + k * half, y, 5, a * seg(p, .6, 1) * .7);
}
// Стрельчатая арка — золотая линия, рисуется снизу вверх (p 0..1)
function arch(cx, base, top, half, p, a, lw = 2) {
  if (p <= 0 || a <= 0) return;
  const shoulder = top + half * 1.25;
  const path = side => { const pts = [];
    for (let i = 0; i <= 40; i++) pts.push([cx + side * half, lerp(base, shoulder, i / 40)]);
    for (let i = 1; i <= 40; i++) { const k = i / 40, u = 1 - k;
      pts.push([u*u*(cx + side * half) + 2*u*k*(cx + side * half) + k*k*cx, u*u*shoulder + 2*u*k*(top + half * .25) + k*k*top]); }
    return pts; };
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineWidth = lw; g.strokeStyle = rgba(C.gold, .85 * a);
  g.shadowColor = rgba(C.goldHi, .7 * a); g.shadowBlur = 16;
  for (const side of [-1, 1]) { const pts = path(side), n = Math.floor(pts.length * p);
    g.beginPath(); pts.slice(0, Math.max(2, n)).forEach((q, i) => i ? g.lineTo(...q) : g.moveTo(...q)); g.stroke(); }
  g.restore();
}
function paperQuad(x, y, w, rot, a, lit = 1, flat = 0) {
  if (a <= 0) return;
  g.save(); g.translate(x, y);
  if (flat) { g.scale(1, .3); g.rotate(rot); } else { g.rotate(rot); g.transform(1, 0, Math.sin(rot * 1.7) * .45, .82 + .18 * Math.cos(rot * 1.3), 0, 0); }
  if (w > 64 && !flat) g.filter = `blur(${((w - 64) / 12).toFixed(1)}px)`;
  const h = w * 1.3;
  const gr = g.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  gr.addColorStop(0, `rgba(255,236,200,${a * lit})`); gr.addColorStop(.5, `rgba(${Math.round(lerp(90, 238, lit))},${Math.round(lerp(55, 170, lit))},${Math.round(lerp(25, 100, lit))},${a * .9})`); gr.addColorStop(1, `rgba(60,34,14,${a * .8})`);
  g.fillStyle = gr; g.fillRect(-w / 2, -h / 2, w, h);
  g.fillStyle = `rgba(80,45,15,${a * .35})`;
  for (let i = 0; i < 6; i++) g.fillRect(-w / 2 + w * .12, -h / 2 + h * (.16 + i * .12), w * (i % 2 ? .55 : .72), Math.max(.8, w * .018));
  g.restore();
}
// Шёлковая лента: пучок нитей с атласным блеском
function ribbon(t, y0, amp, width, color, hi, a, phase = 0, speed = .8) {
  if (a <= 0) return;
  g.save(); g.globalCompositeOperation = 'lighter';
  const N = 34;
  for (let k = 0; k < N; k++) {
    const q = k / (N - 1);
    g.beginPath();
    for (let x = -40; x <= W + 40; x += 14) {
      const u = x / W;
      const cy = y0 + Math.sin(u * 5.2 + t * speed + phase) * amp + Math.sin(u * 2.1 - t * .5 + phase) * amp * .5;
      const wv = width * (.55 + .45 * Math.sin(u * 3.3 + t * .7 + phase));
      const tw = Math.sin(u * 4 + t * .6 + phase); // перекрут
      const y = cy + (q - .5) * wv * tw;
      x === -40 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    const sheen = Math.pow(Math.max(0, Math.sin(q * Math.PI * 1.2 + t * .8 + phase)), 6);
    g.strokeStyle = rgba(sheen > .3 ? hi : color, a * (.05 + .22 * sheen + .06 * Math.sin(q * 3.14)));
    g.lineWidth = 1.6; g.stroke();
  }
  g.restore();
}

/* ---------- частицы ---------- */
const dust = (() => { const r = rng(3); return Array.from({ length: 170 }, () => ({ x: r() * W, y: r() * H, s: .6 + r() * 2.2, v: 6 + r() * 16, ph: r() * 6.28, a: .12 + r() * .5 })); })();
const flyers = (() => { const r = rng(21); return Array.from({ length: 22 }, () => ({ x: 560 + r() * 380, y: 1220 + r() * 300, vx: 25 + r() * 60, vy: -(60 + r() * 90), rot: r() * 6.28, vr: (r() - .5) * 1.6, w: 22 + r() * (r() > .8 ? 90 : 46), ph: r() * 6.28, delay: r() * 3 })); })();
const floorPapers = (() => { const r = rng(9); return Array.from({ length: 46 }, () => ({ x: 40 + r() * 1000, y: 2395 + r() * 170, rot: r() * 6.28, w: 44 + r() * 64 })); })();
const vortex = (() => { const r = rng(44); return Array.from({ length: 28 }, () => ({ th: r() * 6.28, r0: 560 + r() * 520, w: 26 + r() * (r() > .75 ? 90 : 44), rot: r() * 6.28, delay: r() * 1.4, spin: 1.6 + r() * 1.6 })); })();
const grains = [0, 1, 2, 3].map(s => {
  const c = document.createElement('canvas'); c.width = 270; c.height = 480;
  const x = c.getContext('2d'), d = x.createImageData(270, 480), r = rng(100 + s);
  for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0); return c;
});

