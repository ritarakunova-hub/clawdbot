import * as THREE from 'three';
import { smoothstep as sstep, easeInOut } from '@/lib/easing';
import { isReducedMotion } from '@/lib/a11y';
import { getSharedRenderer, Unsupported, onContextLost, onContextRestored } from '../../canvas';
import { buildProjectSheets } from '../../objects/projectScene';
import { buildPostFx } from '../hero/postFx';
import * as loop from '../../loop';
import * as scroll from '../../scroll';
import * as quality from '../../quality';

const SCENE_ID = 'project';

export interface ProjectSceneElements {
  /** 260vh-элемент — по нему считается прогресс скролла сцены. */
  root: HTMLElement;
  /** Четыре подписи-шага (см. Project.astro) — переключаются по прогрессу. */
  steps: HTMLElement[];
}

export interface ProjectSceneHandle {
  destroy(): void;
}

/**
 * Сцена 5 «Проект» (Этап 8): хаос листов на GPU оседает на стеллаж —
 * у каждого листа своя случайная задержка (aDelay в шейдере), поэтому
 * оседание идёт вразнобой, а не одним кадром. Один uniform uOrder
 * ведёт всё превращение, свет каждого листа при этом идёт от
 * красного к золотому. Подписи шагов («Задача», «Сделали», «Проверили»,
 * «Получили» — реальные данные кейса, не выдуманные) сменяются
 * перекрёстным появлением по 400 мс через CSS.
 */
export function mountProjectScene(el: ProjectSceneElements): ProjectSceneHandle {
  const { root, steps } = el;

  const lowPower = (navigator.hardwareConcurrency || 8) <= 4 || Math.min(innerWidth, innerHeight) < 640;

  const renderer = getSharedRenderer(); // бросает Unsupported при неудаче

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 90);
  const three = new THREE.Scene();

  let sheets!: THREE.Mesh;
  let sheetMaterial!: THREE.ShaderMaterial;
  let postFx: ReturnType<typeof buildPostFx> | undefined;

  let ready = false;
  let buildToken = 0;
  let tNow = 0;
  let lastDt = 1 / 60;
  let activeStep = -1;

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
    const built = buildProjectSheets(lowPower);
    sheets = built.mesh;
    sheetMaterial = built.material;
    three.add(sheets);

    postFx = buildPostFx(renderer, three, camera, lowPower);
    layout();
  }

  function prepare() {
    if (ready) return;
    const token = ++buildToken;
    queueMicrotask(() => {
      if (token !== buildToken) return;
      build();
      ready = true;
    });
  }

  function dispose() {
    buildToken++;
    if (!ready) return;
    ready = false;
    postFx?.composer.dispose();
    postFx = undefined;
    disposeSceneContents(three);
    three.clear();
  }

  function setActiveStep(index: number) {
    if (index === activeStep) return;
    activeStep = index;
    steps.forEach((stepEl, i) => stepEl.classList.toggle('is-active', i === index));
  }

  function update(p: number, dt: number) {
    if (!ready || !postFx) return;
    lastDt = dt;
    tNow += dt;
    const reduced = isReducedMotion();

    // reduced-motion: сразу финальный статичный кадр — стеллаж собран,
    // свет золотой, виден последний шаг («Получили»).
    const ps = reduced ? 1 : p;
    const order = sstep(0.04, 0.72, ps);

    sheetMaterial.uniforms.uOrder.value = order;
    sheetMaterial.uniforms.uTime.value = tNow;

    const dollyP = easeInOut(ps);
    camera.position.set(0, 0, 4.4 - dollyP * 0.8);
    camera.lookAt(0, 0, -5);
    camera.updateMatrixWorld();

    const stepIndex = Math.min(steps.length - 1, Math.floor(ps * steps.length));
    setActiveStep(stepIndex);

    postFx.finalPass.uniforms.uFade.value = sstep(0, 0.5, tNow);
    postFx.finalPass.uniforms.uFlash.value = 0;
    postFx.finalPass.uniforms.uTime.value = tNow;
    postFx.bloom.strength = 0.32 + order * 0.28;
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

  const offContextLost = onContextLost(() => root.classList.add('project-reveal--ctxlost'));
  const offContextRestored = onContextRestored(() => root.classList.remove('project-reveal--ctxlost'));

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
    const mesh = obj as Partial<THREE.Mesh>;
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
