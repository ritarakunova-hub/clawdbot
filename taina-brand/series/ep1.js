// Серия 1 «Дождь». 37 с.
// 0–6 Петербург под дождём, титр · 6–24.5 улица: «Кыш!», «Нельзя!», «Закрыто!», красный ромб вдали
// 24.5–34.3 дверь TAINA: Маргарита «Заходи, Бегемот. Теперь ты дома.» · 34.3–37 финальная карточка

// Путь кота по улице: [время, x]
const PATH1 = [[6, 180], [8.3, 560], [8.55, 560], [8.75, 510], [9.4, 510], [11.0, 1450], [12.3, 1560], [12.55, 1560], [12.75, 1515], [13.6, 1515],
  [15.2, 2450], [16.4, 2580], [17.6, 2580], [19.4, 2900], [22.8, 2900], [24.5, 3500]];
function pathX(P, t) {
  if (t <= P[0][0]) return P[0][1];
  for (let i = 0; i < P.length - 1; i++) { const [t0, x0] = P[i], [t1, x1] = P[i + 1]; if (t <= t1) return lerp(x0, x1, (t - t0) / (t1 - t0)); }
  return P[P.length - 1][1];
}

function scene(t) {
  if (t < 6) {
    const z = lerp(1.08, 1, eo(seg(t, 0, 6)));
    g.save(); g.translate(W / 2, H / 2); g.scale(z, z); g.translate(-W / 2, -H / 2);
    skyline(t, 1); g.restore();
    rain(t, 1); splashes(t, 1640, .6);
    titleCard(t, .8, 5.6, 1, 'Дождь');
    g.fillStyle = rgba(C.void, seg(t, 5.6, 6)); g.fillRect(0, 0, W, H);
    return;
  }
  if (t < 24.5) {
    const cx = pathX(PATH1, t), camX = cx - 330;
    const doors = {
      A: bell(t, 8.3, 10.4, .25, .5),
      B: bell(t, 12.35, 14.2, .25, .5),
      C: t > 16.6 ? -1 : 0,
    };
    street(t, camX, 1, doors);
    const G = STREET.ground;
    // прохожие в дверях
    shooer(STREET.doors.A - camX + 20, G, 1.05, doors.A, t, 1);
    shooer(STREET.doors.B - camX + 20, G, 1.05, doors.B, t, 0);
    // кот
    const run = (t > 9.4 && t < 11) || (t > 13.6 && t < 15.2) ? 1 : 0;
    const flinch = (t > 8.5 && t < 8.8) || (t > 12.5 && t < 12.8);
    const head = t < 17.6 ? 0 : t < 22 ? eio(seg(t, 18, 19.4)) : lerp(1, -.7, eio(seg(t, 22, 22.6)));
    catWalk(330 + (flinch ? -8 : 0), G + 10, 1.65, cx / 62 * (run ? 1.15 : 1), { headDown: head, tailUp: t > 17.6 && t < 22 ? .35 : 1, glint: bell(t, 22.3, 23.1, .2, .5), bob: pathX(PATH1, t + .05) !== cx });
    rain(t, 1.1); splashes(t, G + 40, 1);
    shout(t, 8.55, 10.0, 'Кыш!', STREET.doors.A - camX - 40, G - 560);
    shout(t, 12.6, 13.9, 'Нельзя!', STREET.doors.B - camX - 40, G - 560);
    shout(t, 16.7, 17.9, 'Закрыто!', STREET.doors.C - camX, G - 560);
    sub(t, 19.6, 22.3, 'Бегемот', 'Неужели в этом городе\nнет двери для меня?');
    // красный отблеск впереди
    if (t > 21.8) glow(W - 20, G - 520, 260, C.red, .35 * seg(t, 21.8, 22.6) * (camX < 2800 ? 1 : 0));
    g.fillStyle = rgba(C.void, seg(t, 24.1, 24.5)); g.fillRect(0, 0, W, H);
    return;
  }
  if (t < 34.3) {
    // у двери TAINA
    const G = 1500, open = eo(seg(t, 26.6, 27.6)) * (1 - eio(seg(t, 33.6, 34.3)));
    const sky = g.createLinearGradient(0, 0, 0, G); sky.addColorStop(0, NIGHT.sky0); sky.addColorStop(1, '#0D1016');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.fillStyle = '#0B0E13'; g.fillRect(0, 200, W, G - 200);
    g.strokeStyle = rgba(C.gold, .06); for (let yy = G - 520; yy < G; yy += 40) { g.beginPath(); g.moveTo(0, yy); g.lineTo(W, yy); g.stroke(); }
    streetLamp(90, G + 30, 1, 1, t);
    taina(560, G, t, open, 1.6);
    if (open > .05) silhouette(MARGO, 580, G, 1.45, { light: [0, -1], rim: '#FFE3B0', rimA: open, fur: 0, glowA: .6 });
    const pg = g.createLinearGradient(0, G, 0, H); pg.addColorStop(0, '#101318'); pg.addColorStop(1, '#050608');
    g.save(); g.globalCompositeOperation = 'source-over'; g.fillStyle = pg; g.fillRect(0, G, W, H - G); g.restore();
    if (open > 0) { g.save(); g.globalCompositeOperation = 'lighter'; const sp = g.createLinearGradient(0, G, 0, G + 400); sp.addColorStop(0, rgba('#FFB060', .45 * open)); sp.addColorStop(1, rgba('#FFB060', 0)); g.fillStyle = sp; g.beginPath(); g.moveTo(376, G); g.lineTo(744, G); g.lineTo(1060, G + 420); g.lineTo(60, G + 420); g.closePath(); g.fill(); g.restore(); }
    // кот подходит, смотрит вверх, входит
    const walkIn = seg(t, 32.2, 33.6);
    const x = t < 26.2 ? lerp(-260, 250, eo(seg(t, 24.5, 26.2))) : lerp(250, 520, eio(walkIn));
    const moving = t < 26.2 || (t > 32.2 && t < 33.6);
    const sc = lerp(1.8, 1.25, eio(walkIn));
    g.save(); g.globalAlpha = 1 - seg(t, 33.2, 33.6);
    catWalk(x, G + 10 - walkIn * 30, sc, moving ? x / 55 : 1.2, { light: open > .1 ? [1, -.3] : [-.6, -1], rimA: 1, headDown: t > 26.6 ? -.8 * eo(seg(t, 26.6, 27.4)) * (1 - walkIn) : 0, glint: bell(t, 30.8, 31.8, .2, .5), bob: moving });
    g.restore();
    rain(t, 1 - open * .4); splashes(t, G + 40, 1);
    sub(t, 28.0, 30.4, 'Маргарита', 'Заходи, Бегемот.');
    sub(t, 30.6, 33.2, 'Маргарита', 'Теперь ты дома.');
    return;
  }
  endCard(t, 34.3, 1, 'Дождь');
}
window.EP = { dur: 37, scene };
window.FILM = { w: W, h: H, dur: 37 };
