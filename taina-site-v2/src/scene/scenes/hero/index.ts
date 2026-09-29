import * as THREE from 'three';
import { clamp, smoothstep as sstep, lerp, easeOut as eOut, easeInOut as eInOut, easeBack as eBack } from '@/lib/easing';
import { isReducedMotion } from '@/lib/a11y';
import { getSharedRenderer, Unsupported, onContextLost, onContextRestored } from '../../canvas';
import { createSharedUniforms } from '../../uniforms';
import { buildSheets } from '../../objects/sheets';
import { buildDiamond } from '../../objects/diamond';
import { buildFloor } from '../../objects/floor';
import { buildDust } from '../../objects/dust';
import { buildCat } from '../../objects/cat';
import { buildPostFx } from './postFx';
import * as loop from '../../loop';
import * as scroll from '../../scroll';
import * as quality from '../../quality';

const SCENE_ID = 'hero';

export interface HeroSceneElements {
  hero: HTMLElement;
  stage: HTMLElement;
  copy: HTMLElement;
  h1: HTMLElement;
  cueScroll: HTMLElement;
  /** Куда падает изображение кота (public/img/cat-eyes.jpg). */
  catImageUrl: string;
}

export interface HeroSceneHandle {
  destroy(): void;
}

/**
 * Перенос сцены первого экрана из reference/taina-hero.html — тот же
 * PRNG для листов, те же тайминги вступления, поведение курсора и
 * адаптивный DPR. Сцена рисуется в общий холст сайта (canvas.ts) и
 * подключается к общему циклу (loop.ts) через prepare/dispose/update/
 * render — цикл сам решает, когда сцена активна (держит скролл),
 * соседняя (наготове) или далеко (можно освободить GPU-ресурсы).
 *
 * Бросает Unsupported, если WebGL2 недоступен или инициализация упала —
 * вызывающий код (Hero.astro) ловит это и включает CSS-заглушку ромба.
 */
export function mountHeroScene(el: HeroSceneElements): HeroSceneHandle {
  const { hero, stage, copy, h1, cueScroll } = el;

  const coarse = matchMedia('(pointer: coarse)').matches;
  const lowPower = (navigator.hardwareConcurrency || 8) <= 4 || Math.min(innerWidth, innerHeight) < 640;

  function setSweep(v: number) {
    h1.style.setProperty('--s', v + '%');
  }

  const renderer = getSharedRenderer(); // бросает Unsupported при неудаче
  quality.initQuality({ lowPower, webglAvailable: true });
  let appliedDpr = quality.getDpr();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, appliedDpr));

  const three = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 90);
  const base = { camZ: 10, portrait: false };
  const D0 = new THREE.Vector3(1.9, 0.1, 0); // позиция покоя ромба
  let dScale0 = 1;
  const catBase = { x: 0.4, y: 2.55 };

  const U = createSharedUniforms();

  // --- объекты сцены (строятся в build(), вызывается из prepare()) ---
  let sheets: THREE.Mesh;
  let dia: THREE.Group;
  let diaMaterial: THREE.ShaderMaterial;
  let diaEdges: THREE.LineSegments;
  let halo: THREE.Group;
  let haloA: THREE.Mesh;
  let haloB: THREE.Mesh;
  let streakH: THREE.Mesh;
  let streakV: THREE.Mesh;
  let floor: THREE.Mesh;
  let dust: THREE.Points;
  let catMesh: THREE.Mesh;
  let catMaterial: THREE.ShaderMaterial;
  let postFx: ReturnType<typeof buildPostFx> | undefined;
  let ready = false;
  let buildToken = 0;
  let lastDt = 1 / 60;

  function layout() {
    const w = innerWidth;
    const h = innerHeight;
    const a = w / h;
    base.portrait = a < 0.85;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.getDpr()));
    renderer.setSize(w, h, false);
    if (postFx) {
      postFx.composer.setPixelRatio(renderer.getPixelRatio());
      postFx.composer.setSize(w, h);
    }
    camera.aspect = a;
    U.uPortrait.value = base.portrait ? 1 : 0;
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    if (base.portrait) {
      base.camZ = 13.4;
      const hh = tan * base.camZ;
      const hwp = hh * a;
      D0.set(-hwp * 0.26, hh * 0.58, 0);
      dScale0 = 0.5;
    } else {
      base.camZ = 10;
      const hh2 = tan * base.camZ;
      const hw = hh2 * a;
      D0.set(clamp(hw * 0.44, 1.2, 3.4), 0.12, 0);
      dScale0 = clamp(a / 1.6, 0.8, 1.15);
    }
    camera.updateProjectionMatrix();
    if (catMesh) {
      if (base.portrait) {
        const d2 = tan * (base.camZ + 7);
        catBase.x = d2 * a * 0.5;
        catBase.y = d2 * 0.6;
        catMesh.position.set(catBase.x, catBase.y, -7);
        catMesh.scale.setScalar(0.55);
      } else {
        const hwc = Math.tan(THREE.MathUtils.degToRad(15)) * 18 * a;
        catBase.x = hwc * 0.05;
        catBase.y = 2.55;
        catMesh.position.set(catBase.x, catBase.y, -8);
        catMesh.scale.setScalar(1);
      }
    }
    if (dust) (dust.material as THREE.ShaderMaterial).uniforms.uPx.value = renderer.getPixelRatio();
  }

  // --- ввод ---
  const ptr = { x: 0, y: 0, sx: 0, sy: 0, last: -1e9, has: false };
  function onPointerMove(e: PointerEvent) {
    ptr.x = (e.clientX / innerWidth) * 2 - 1;
    ptr.y = -((e.clientY / innerHeight) * 2 - 1);
    ptr.last = performance.now();
    ptr.has = true;
  }
  addEventListener('pointermove', onPointerMove, { passive: true });
  addEventListener('pointerdown', onPointerMove, { passive: true });

  // --- состояние сцены ---
  let tNow = 0;
  let introDone = false;
  let copyShown = false;
  let sweepStart: number | null = null;
  let blinkAt = 6;
  let blinkT = -1;

  const tmp = new THREE.Vector3();
  const dir = new THREE.Vector3();

  const fontsReady = Promise.race([
    Promise.all([
      document.fonts.load('italic 500 58px "Cormorant Garamond"'),
      document.fonts.load('500 16px Inter'),
    ]).catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, 2500)),
  ]);

  /** Строит все Three.js-объекты сцены — вызывается один раз на «сборку». */
  function build() {
    layout();
    const builtSheets = buildSheets(renderer, U, D0, lowPower);
    sheets = builtSheets.mesh;
    three.add(sheets);

    const diamond = buildDiamond(U.uTime);
    dia = diamond.group;
    diaMaterial = diamond.material;
    diaEdges = diamond.edges;
    halo = diamond.halo;
    haloA = diamond.haloA;
    haloB = diamond.haloB;
    streakH = diamond.streakH;
    streakV = diamond.streakV;
    three.add(dia, halo, streakH, streakV);

    floor = buildFloor(U.uKeyPos);
    three.add(floor);

    dust = buildDust(renderer, U, lowPower);
    three.add(dust);

    const cat = buildCat(el.catImageUrl);
    catMesh = cat.mesh;
    catMaterial = cat.material;
    three.add(catMesh);

    postFx = buildPostFx(renderer, three, camera, lowPower);
    layout();

    dia.scale.setScalar(0.001);
  }

  /** prepare() — идемпотентно строит сцену; вызывается циклом (loop.ts),
   * пока эта сцена активна или соседняя. Тяжёлая сборка ждёт шрифты
   * (fontsReady), чтобы не ловить FOUT в световом фронте по заголовку. */
  function prepare() {
    if (ready) return;
    const token = ++buildToken;
    fontsReady.then(() => {
      if (token !== buildToken) return; // сцену успели освободить (dispose) или пересобрать заново
      build();
      ready = true;
    });
  }

  /** dispose() — идемпотентно освобождает GPU-ресурсы; вызывается циклом,
   * когда сцена далеко (не активна и не соседняя). */
  function dispose() {
    buildToken++; // отменяет незавершённый build() из prepare(), если он ещё ждал шрифты
    if (!ready) return;
    ready = false;
    postFx?.composer.dispose();
    postFx = undefined;
    disposeSceneContents(three);
    three.clear();
  }

  /** update(p, dt) — вызывается общим циклом (loop.ts), пока сцена активна или соседняя. */
  function update(p: number, dt: number) {
    if (!ready) return;
    lastDt = dt;
    const reduced = isReducedMotion();

    tNow += dt;
    const it = reduced ? 99 : tNow; // время вступления

    const fade = sstep(0, 1.1, it);
    const spark = sstep(0.2, 0.9, it) * (1 - sstep(0.9, 1.5, it) * 0.55);
    const dia_s = eBack((it - 0.85) / 1.25);
    const keyI = eOut((it - 1.0) / 1.6);
    const streak = eOut((it - 1.0) / 1.7);
    const reveal = lerp(0, 34, eOut((it - 1.1) / 3.4));
    if (!copyShown && it > 1.7) {
      copyShown = true;
      stage.classList.add('on');
    }
    if (sweepStart === null && it > 1.9) sweepStart = it;
    if (sweepStart !== null && !introDone) {
      const sp = clamp((it - sweepStart) / 2.3, 0, 1);
      setSweep(lerp(-25, 130, eInOut(sp)));
      if (sp >= 1) introDone = true;
    }
    if (reduced) {
      setSweep(130);
      stage.classList.add('on');
      introDone = true;
    }

    // Общий цикл уже отдаёт сглаженный прогресс скролла (scroll.ts,
    // k = 1 − 0.003^dt). При reduced-motion игнорируем реальный скролл —
    // сцена держит состояние покоя (ps=0), текст остаётся на месте.
    const ps = reduced ? 0 : p;
    const pz = eInOut(ps);
    const pm = sstep(0.12, 0.72, ps);
    const pf = sstep(0.84, 0.975, ps);

    const idle = performance.now() - ptr.last > 3200 || !ptr.has || coarse;
    const ax = Math.sin(tNow * 0.23) * 0.55 + Math.sin(tNow * 0.11 + 1) * 0.25;
    const ay = Math.sin(tNow * 0.17 + 2) * 0.32;
    const tx = idle ? ax : ptr.x;
    const ty = idle ? ay : ptr.y;
    ptr.sx += (tx - ptr.sx) * (1 - Math.pow(0.001, dt));
    ptr.sy += (ty - ptr.sy) * (1 - Math.pow(0.001, dt));

    const breath = reduced ? 0 : Math.sin(tNow * 0.5) * 0.02;
    const push = lerp(1.2, 0, eOut(it / 5.2));
    camera.position.set(
      ptr.sx * (reduced ? 0 : 0.32) * (1 - pz),
      0.1 + ptr.sy * (reduced ? 0 : 0.16) * (1 - pz) + breath,
      base.camZ + push - pz * (base.camZ - 4.6),
    );
    camera.lookAt(0, 0, -2.5);
    camera.updateMatrixWorld();

    const dScale = Math.max(0.001, dia_s) * dScale0 * (1 + pz * 0.55);
    dia.scale.setScalar(dScale);
    const bx = lerp(D0.x, 0, pm);
    const by = lerp(D0.y, 0.05, pm) + Math.sin(tNow * 0.6) * 0.05 * (1 - pz);
    const bz = lerp(D0.z, 3.4, sstep(0.55, 0.96, ps));
    dia.position.set(bx, by, bz);
    // Меньше амплитуда, чем в исходном прототипе: ромб — плоский символ
    // (как масть «бубны» в картах), а не вращающийся 3D-камень — если
    // крутить его сильно, видно грань сзади/спереди, и силуэт перестаёт
    // читаться как ромб (см. правку по бренд-буку).
    dia.rotation.y = Math.sin(tNow * 0.31) * 0.16 + ptr.sx * 0.18;
    dia.rotation.x = -ptr.sy * 0.08 + Math.sin(tNow * 0.23) * 0.02;
    dia.rotation.z = 0;
    diaMaterial.uniforms.uI.value = (0.5 + 0.5 * keyI) * 0.84 * (1 + pz * 0.3);
    (diaEdges.material as THREE.LineBasicMaterial).opacity = 0.7 * keyI;

    U.uTime.value = tNow;
    U.uKeyPos.value.set(bx, by, bz - 0.4);
    U.uKeyI.value = keyI * (0.5 + pz * 0.45);
    U.uKeyR.value = 5.4 + pz * 4;
    U.uReveal.value = reveal + ps * 30;

    camera.getWorldDirection(dir);
    tmp.set(ptr.sx, ptr.sy, 0.5).unproject(camera).sub(camera.position).normalize();
    const zPlane = -2.6;
    const tt = (zPlane - camera.position.z) / tmp.z;
    U.uCurPos.value.copy(camera.position).addScaledVector(tmp, tt);
    U.uCurI.value = sstep(3.2, 4.6, it) * 1.2 * (1 - pf);

    halo.position.set(bx, by, bz - 1.0 * dScale - 0.15);
    halo.quaternion.copy(camera.quaternion);
    const hs = Math.max(0.001, dScale);
    (haloA.material as THREE.ShaderMaterial).uniforms.uI.value = (spark * 0.5 + keyI * 0.12) * (1 + pz * 1.4);
    (haloB.material as THREE.ShaderMaterial).uniforms.uI.value = (spark * 0.8 + keyI * 0.16) * (1 + pz * 1.0);
    halo.scale.setScalar(0.6 + 0.4 * Math.max(hs, spark) * 1);

    streakH.position.set(bx, by, bz - 1.0 * dScale - 0.2);
    streakH.quaternion.copy(camera.quaternion);
    streakV.position.set(bx, by + 0.05, bz - 1.0 * dScale - 0.2);
    streakV.quaternion.copy(camera.quaternion);
    streakV.rotateZ(Math.PI / 2);
    streakH.scale.set(streak * (1 + pz * 0.6) + 0.001, 1, 1);
    streakV.scale.set(streak * 0.8 + 0.001, 1, 1);
    (streakH.material as THREE.ShaderMaterial).uniforms.uI.value = (spark * 0.5 + keyI * 0.2) * (1 - pf * 0.3);
    (streakV.material as THREE.ShaderMaterial).uniforms.uI.value = spark * 0.4 + keyI * 0.13;
    (floor.material as THREE.ShaderMaterial).uniforms.uI.value = keyI * 0.42 * (1 - pz * 0.7);

    const catIn = sstep(3.9, 5.4, it);
    const near = Math.exp(-(Math.pow(ptr.sx - 0.05, 2) + Math.pow(ptr.sy - 0.5, 2)) * 2.2) * (idle ? 0 : 1);
    if (blinkT < 0 && tNow > blinkAt) blinkT = 0;
    let blink = 0;
    if (blinkT >= 0) {
      blinkT += dt;
      const b = blinkT / 0.28;
      blink = b < 1 ? Math.sin(b * Math.PI) : 0;
      if (b >= 1) {
        blinkT = -1;
        blinkAt = tNow + 5 + Math.random() * 5;
      }
    }
    catMaterial.uniforms.uVis.value = catIn * (0.7 + 0.5 * near) * (1 - pz * 0.9);
    catMaterial.uniforms.uBlink.value = blink;
    catMesh.position.x = catBase.x - ptr.sx * 0.25;
    catMesh.position.y = catBase.y + ptr.sy * 0.15;

    const co = 1 - sstep(0.02, 0.3, ps);
    copy.style.opacity = String(co);
    copy.style.transform = `translate3d(0,${(-ps * 90).toFixed(1)}px,0)`;
    copy.style.pointerEvents = co < 0.2 ? 'none' : 'auto';
    cueScroll.style.opacity = String(1 - sstep(0, 0.05, ps));

    if (postFx) {
      postFx.bloom.strength = 0.42 + pz * 0.5 + spark * 0.3;
      postFx.finalPass.uniforms.uTime.value = tNow;
      postFx.finalPass.uniforms.uFade.value = fade * (1 - sstep(0.985, 1, ps));
      postFx.finalPass.uniforms.uFlash.value = pf * (1 - sstep(0.95, 0.995, ps) * 0.0);
    }

    // DPR уже пересчитан в quality.ts (общий цикл копит время кадра) —
    // здесь только замечаем изменение и применяем его к рендереру.
    const currentDpr = quality.getDpr();
    if (currentDpr !== appliedDpr) {
      appliedDpr = currentDpr;
      layout();
    }
  }

  /** render() — вызывается общим циклом только для активной сцены. */
  function render() {
    if (!ready || !postFx) return;
    postFx.composer.render(lastDt);
  }

  let resizeTimer = 0;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(layout, 120);
  }
  addEventListener('resize', onResize);

  function onFirstPointerDown() {
    if (!isReducedMotion() && tNow < 5) tNow += 5;
  }
  addEventListener('pointerdown', onFirstPointerDown, { once: true });

  // Общий холст — одна точка отказа: если WebGL-контекст теряется,
  // рисование само остановится (three.js это знает изнутри), но пока
  // контекст не восстановлен, показываем статичную CSS-заглушку поверх
  // сцены (тот же приём, что и для отсутствия WebGL2, см. .hero--nogl).
  // При восстановлении three.js сам перезаливает GPU-ресурсы существующих
  // объектов при следующем рендере — пересобирать сцену вручную не нужно.
  const offContextLost = onContextLost(() => hero.classList.add('hero--ctxlost'));
  const offContextRestored = onContextRestored(() => hero.classList.remove('hero--ctxlost'));

  scroll.registerTarget(SCENE_ID, hero);
  loop.registerScene({ id: SCENE_ID, prepare, dispose, update, render });
  loop.start();

  return {
    destroy() {
      clearTimeout(resizeTimer);
      removeEventListener('pointermove', onPointerMove);
      removeEventListener('pointerdown', onPointerMove);
      removeEventListener('pointerdown', onFirstPointerDown);
      removeEventListener('resize', onResize);
      offContextLost();
      offContextRestored();
      loop.unregisterScene(SCENE_ID);
      scroll.unregisterTarget(SCENE_ID);
      dispose();
    },
  };
}

/**
 * В прототипе сцена жила на статической странице и никогда не
 * размонтировалась, поэтому очистки там не было. Здесь hero может
 * пережить unmount (переход по SPA-навигации в будущем, hot-reload
 * в dev, dispose() при уходе далеко вниз по странице) — освобождаем
 * геометрии, материалы и текстуры, которые держат материалы в
 * собственных юниформах (их renderer.dispose() сам не находит, в
 * отличие от стандартных .map/.normalMap и т.п.).
 */
function disposeSceneContents(scene: THREE.Scene) {
  scene.traverse((obj) => {
    const mesh = obj as Partial<THREE.Mesh & THREE.Points>;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const material of materials) {
      if (material instanceof THREE.ShaderMaterial) {
        for (const uniform of Object.values(material.uniforms)) {
          if (uniform.value instanceof THREE.Texture) uniform.value.dispose();
        }
      }
      material.dispose();
    }
  });
}

export { Unsupported };
