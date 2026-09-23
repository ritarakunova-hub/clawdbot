import * as THREE from 'three';
import { smoothstep as sstep } from '@/lib/easing';
import { isReducedMotion } from '@/lib/a11y';
import { getSharedRenderer, Unsupported, onContextLost, onContextRestored } from '../../canvas';
import { buildCat } from '../../objects/cat';
import { buildDiamond } from '../../objects/diamond';
import { buildPostFx } from '../hero/postFx';
import * as loop from '../../loop';
import * as scroll from '../../scroll';
import * as quality from '../../quality';

const SCENE_ID = 'behemoth';

export interface BehemothSceneElements {
  /** 120vh-элемент — по нему считается прогресс скролла сцены. */
  root: HTMLElement;
  lead: HTMLElement;
  quote: HTMLElement;
  /** Куда падает изображение кота (public/img/cat-eyes.jpg) — то же, что в хиро. */
  catImageUrl: string;
}

export interface BehemothSceneHandle {
  destroy(): void;
}

/**
 * Сцена 6 «Бегемот» (Этап 8): свет падает почти до нуля, проявляются
 * только глаза кота (тот же приём, что и камео в хиро — luminance-маска
 * в cat.frag.glsl), затем фраза. Зрачки «следят» за курсором — честная
 * реализация в пределах плоской фотографии: сдвигаем сам силуэт на
 * ±6px в экранных единицах, а не рисуем отдельные подвижные зрачки
 * (которых на фотографии физически нет). Финал: голова чуть приближается,
 * рядом загорается ромб (тот же риг, что в хиро), тёплый свет ведёт
 * в «Пакеты».
 */
export function mountBehemothScene(el: BehemothSceneElements): BehemothSceneHandle {
  const { root, lead, quote } = el;

  const lowPower = (navigator.hardwareConcurrency || 8) <= 4 || Math.min(innerWidth, innerHeight) < 640;
  const coarse = matchMedia('(pointer: coarse)').matches;

  const renderer = getSharedRenderer(); // бросает Unsupported при неудаче

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 90);
  const three = new THREE.Scene();

  let catMesh!: THREE.Mesh;
  let catMaterial!: THREE.ShaderMaterial;
  let dia!: THREE.Group;
  let diaMaterial!: THREE.ShaderMaterial;
  let postFx: ReturnType<typeof buildPostFx> | undefined;
  const diaTime = { value: 0 };

  let ready = false;
  let buildToken = 0;
  let tNow = 0;
  let lastDt = 1 / 60;
  let blinkAt = 3;
  let blinkT = -1;

  const catBase = { x: 0, y: 0 };
  // Место правого (по фото) глаза кота в локальных координатах плоскости
  // (4.6×4.6, см. objects/cat.ts) — вычислено по яркости пикселей
  // public/img/cat-eyes.jpg (центроид самой светлой области справа).
  const eyeOffset = { x: 0.5, y: 0.09 };

  const ptr = { x: 0, y: 0, sx: 0, sy: 0, last: -1e9, has: false };
  function onPointerMove(e: PointerEvent) {
    ptr.x = (e.clientX / innerWidth) * 2 - 1;
    ptr.y = -((e.clientY / innerHeight) * 2 - 1);
    ptr.last = performance.now();
    ptr.has = true;
  }
  addEventListener('pointermove', onPointerMove, { passive: true });

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
    if (catMesh) {
      catBase.x = 0;
      catBase.y = 0;
      catMesh.position.set(catBase.x, catBase.y, -3);
    }
  }

  function build() {
    layout();
    const cat = buildCat(el.catImageUrl);
    catMesh = cat.mesh;
    catMaterial = cat.material;
    catMesh.scale.setScalar(1.7);
    three.add(catMesh);

    const diamond = buildDiamond(diaTime);
    dia = diamond.group;
    diaMaterial = diamond.material;
    dia.scale.setScalar(0.001);
    three.add(dia);

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

  function update(p: number, dt: number) {
    if (!ready || !postFx) return;
    lastDt = dt;
    tNow += dt;
    const reduced = isReducedMotion();

    // reduced-motion: финальный статичный кадр — глаза видны, фраза
    // читаема, ромб уже горит, без слежения за курсором.
    const ps = reduced ? 1 : p;

    const leadOut = 1 - sstep(0.1, 0.32, ps);
    lead.style.opacity = String(leadOut);

    const eyesIn = sstep(0.12, 0.5, ps);
    const quoteIn = sstep(0.42, 0.68, ps);
    quote.style.opacity = String(quoteIn);

    const finale = sstep(0.78, 1, ps);

    const idle = performance.now() - ptr.last > 3200 || !ptr.has || coarse || reduced;
    const tx = idle ? 0 : ptr.x;
    const ty = idle ? 0 : ptr.y;
    ptr.sx += (tx - ptr.sx) * (1 - Math.pow(0.001, dt));
    ptr.sy += (ty - ptr.sy) * (1 - Math.pow(0.001, dt));

    // «±6px» — переведено в единицы мира небольшим постоянным множителем,
    // а не пересчитано из экранных пикселей: на такой глубине разница
    // визуально неотличима, а формула проще.
    const trackAmp = 0.045;
    catMesh.position.x = catBase.x - ptr.sx * trackAmp;
    catMesh.position.y = catBase.y + ptr.sy * trackAmp;
    catMesh.position.z = -3 + finale * 0.9;
    catMesh.scale.setScalar(1.7 + finale * 0.35);

    if (blinkT < 0 && tNow > blinkAt) blinkT = 0;
    let blink = 0;
    if (blinkT >= 0) {
      blinkT += dt;
      const b = blinkT / 0.28;
      blink = b < 1 ? Math.sin(b * Math.PI) : 0;
      if (b >= 1) {
        blinkT = -1;
        blinkAt = tNow + 4 + Math.random() * 4;
      }
    }
    catMaterial.uniforms.uVis.value = eyesIn;
    catMaterial.uniforms.uBlink.value = reduced ? 0 : blink;

    // Ромб загорается в зрачке на финале — тот же мотив, что в хиро и
    // в шапке сайта, здесь — маленький и близко к глазу.
    const diaScale = finale * 0.14;
    dia.scale.setScalar(Math.max(0.001, diaScale));
    // eyeOffset — координаты в локальном пространстве плоскости кота
    // (половина стороны 2.3), поэтому масштабируем на её текущий scale,
    // а не на позицию/размер экрана.
    dia.position.set(
      catMesh.position.x + eyeOffset.x * catMesh.scale.x,
      catMesh.position.y + eyeOffset.y * catMesh.scale.y,
      catMesh.position.z + 0.3,
    );
    dia.rotation.y = tNow * 0.6;
    diaMaterial.uniforms.uI.value = finale;
    diaTime.value = tNow;

    camera.position.set(0, 0, 6);
    camera.lookAt(0, 0, -3);
    camera.updateMatrixWorld();

    postFx.finalPass.uniforms.uFade.value = sstep(0, 0.5, tNow);
    postFx.finalPass.uniforms.uFlash.value = finale * 0.45;
    postFx.finalPass.uniforms.uTime.value = tNow;
    postFx.bloom.strength = 0.5 + finale * 0.6;
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

  const offContextLost = onContextLost(() => root.classList.add('behemoth-reveal--ctxlost'));
  const offContextRestored = onContextRestored(() => root.classList.remove('behemoth-reveal--ctxlost'));

  scroll.registerTarget(SCENE_ID, root);
  loop.registerScene({ id: SCENE_ID, prepare, dispose, update, render });
  loop.start();

  return {
    destroy() {
      clearTimeout(resizeTimer);
      removeEventListener('pointermove', onPointerMove);
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
