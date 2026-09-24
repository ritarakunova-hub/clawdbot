import * as THREE from 'three';
import { clamp, smoothstep as sstep, lerp, easeInOut } from '@/lib/easing';
import { isReducedMotion } from '@/lib/a11y';
import { getSharedRenderer, Unsupported, onContextLost, onContextRestored } from '../../canvas';
import { createProyavkaUniforms } from '../../materials/proyavkaMaterial';
import { buildProyavkaObjects } from '../../objects/proyavkaScene';
import { buildPostFx } from '../hero/postFx';
import * as loop from '../../loop';
import * as scroll from '../../scroll';
import * as quality from '../../quality';

const SCENE_ID = 'proyavka';

export interface ProyavkaSceneElements {
  /** 220vh-элемент — по нему считается прогресс скролла сцены. */
  root: HTMLElement;
  /** Заголовок-фраза, проявляющаяся тем же световым фронтом, что и в хиро. */
  phrase: HTMLElement;
}

export interface ProyavkaSceneHandle {
  destroy(): void;
}

/**
 * Сцена 2 «Проявка» (документ «Система движения»): вспышка хиро гаснет
 * за первые 8% скролла, чёрный лист проявляется по яркости 1:1 со
 * скроллом (без сглаживания — сырой прогресс, а не смягченный), фраза
 * проявляется тем же световым фронтом, что заголовок хиро, камера едет
 * вперёд на 0,6 единицы, последние 15% — три вертикальные полосы,
 * задел моста в «Три территории». 220vh, закреплённый вьюпорт.
 *
 * Бросает Unsupported, если WebGL2 недоступен — вызывающий код
 * (Proyavka.astro) ловит это и включает CSS-заглушку.
 */
export function mountProyavkaScene(el: ProyavkaSceneElements): ProyavkaSceneHandle {
  const { root, phrase } = el;

  const lowPower = (navigator.hardwareConcurrency || 8) <= 4 || Math.min(innerWidth, innerHeight) < 640;

  function setSweep(v: number) {
    phrase.style.setProperty('--s', v + '%');
  }

  const renderer = getSharedRenderer(); // бросает Unsupported при неудаче

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 90);
  const camStartZ = 6;
  const camDolly = 0.6; // «камера едет вперёд на 0,6 единицы»
  const three = new THREE.Scene();

  const U = createProyavkaUniforms();

  let sheet!: THREE.Mesh;
  let frame!: THREE.LineSegments;
  let frameMaterial!: THREE.LineBasicMaterial;
  let stripes: THREE.Mesh[] = [];
  let postFx: ReturnType<typeof buildPostFx> | undefined;

  let ready = false;
  let buildToken = 0;
  let tNow = 0;
  let lastDt = 1 / 60;

  function layout() {
    const w = innerWidth;
    const h = innerHeight;
    const a = w / h;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.getDpr()));
    renderer.setSize(w, h, false);
    if (postFx) {
      postFx.composer.setPixelRatio(renderer.getPixelRatio());
      postFx.composer.setSize(w, h);
    }
    camera.aspect = a;
    camera.updateProjectionMatrix();
  }

  function build() {
    layout();
    const objects = buildProyavkaObjects(U);
    sheet = objects.sheet;
    frame = objects.frame;
    frameMaterial = objects.frameMaterial;
    stripes = objects.stripes;
    three.add(sheet, frame, ...stripes);

    postFx = buildPostFx(renderer, three, camera, lowPower);
    layout();
  }

  /** prepare() — идемпотентно строит сцену; вызывается циклом, пока
   * сцена активна или соседняя (см. loop.ts). */
  function prepare() {
    if (ready) return;
    const token = ++buildToken;
    // Шрифт фразы уже точно загружен к этому моменту (хиро его грузит
    // первым, а «Проявка» всегда после хиро) — ждать fontsReady не нужно.
    queueMicrotask(() => {
      if (token !== buildToken) return;
      build();
      ready = true;
    });
  }

  /** dispose() — идемпотентно освобождает GPU-ресурсы; вызывается,
   * когда сцена далеко (не активна и не соседняя). */
  function dispose() {
    buildToken++;
    if (!ready) return;
    ready = false;
    postFx?.composer.dispose();
    postFx = undefined;
    disposeSceneContents(three);
    three.clear();
  }

  function update(p: number, dt: number) {
    if (!ready || !postFx) return;
    lastDt = dt;
    tNow += dt;
    const reduced = isReducedMotion();

    // При reduced-motion держим финальный проявленный кадр (уровень C:
    // статичная картинка), не гоняясь за реальным скроллом.
    const ps = reduced ? 1 : p;
    // «Проявляется по яркости от скролла... без сглаживания» — сырой,
    // не смягченный прогресс именно для этого параметра.
    const raw = reduced ? 1 : clamp(scroll.getRawProgress(SCENE_ID), 0, 1);

    const flashOut = 1 - sstep(0, 0.08, ps); // гаснущая вспышка хиро
    const revealK = sstep(0.08, 1, raw); // проявление листа — 1:1, без лага

    U.uReveal.value = revealK;
    U.uTime.value = tNow;

    const sweepP = sstep(0.08, 0.35, ps);
    setSweep(lerp(-25, 130, easeInOut(sweepP)));

    const dollyP = easeInOut(ps);
    camera.position.set(0, 0, camStartZ - camDolly * dollyP);
    camera.lookAt(0, 0, -3.6);
    camera.updateMatrixWorld();

    frameMaterial.opacity = 0.7 * sstep(0.15, 0.5, ps);

    const bridgeP = sstep(0.85, 1, ps);
    for (const stripe of stripes) {
      (stripe.material as THREE.ShaderMaterial).uniforms.uI.value = bridgeP * 0.9;
    }

    // uFade — множитель яркости всего кадра в finalPass (см. shaders/
    // finalPass.frag.glsl): без явного значения кадр чёрный. Плавный
    // разгон по времени сцены (не по скроллу) — сцена готовится заранее
    // как соседняя, поэтому к моменту активации уже разогнана.
    postFx.finalPass.uniforms.uFade.value = sstep(0, 0.6, tNow);
    postFx.finalPass.uniforms.uFlash.value = flashOut;
    postFx.finalPass.uniforms.uTime.value = tNow;
    postFx.bloom.strength = 0.4 + revealK * 0.5 + bridgeP * 0.3;
  }

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

  const offContextLost = onContextLost(() => root.classList.add('proyavka-reveal--ctxlost'));
  const offContextRestored = onContextRestored(() => root.classList.remove('proyavka-reveal--ctxlost'));

  scroll.registerTarget(SCENE_ID, root);
  loop.registerScene({ id: SCENE_ID, prepare, dispose, update, render });
  loop.start();

  return {
    destroy() {
      clearTimeout(resizeTimer);
      removeEventListener('resize', onResize);
      offContextLost();
      offContextRestored();
      loop.unregisterScene(SCENE_ID);
      scroll.unregisterTarget(SCENE_ID);
      dispose();
    },
  };
}

function disposeSceneContents(scene: THREE.Scene) {
  scene.traverse((obj) => {
    const mesh = obj as Partial<THREE.Mesh & THREE.LineSegments>;
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
