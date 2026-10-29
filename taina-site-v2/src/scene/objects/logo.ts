import * as THREE from 'three';
import vertexShader from '../shaders/billboard.vert.glsl?raw';
import fragmentShader from '../shaders/logo.frag.glsl?raw';
import { createGlowMaterial } from '../materials/glow';

export interface LogoRig {
  /** Плоскость с логотипом — двигается/масштабируется как одно целое. */
  group: THREE.Group;
  material: THREE.ShaderMaterial;
  /** halo — отдельный объект сцены (билборд к камере), не ребёнок group. */
  halo: THREE.Group;
  haloA: THREE.Mesh;
  haloB: THREE.Mesh;
}

// Логотип (public/img/taina-logo.jpg, 840×720) — светящийся ромб над
// словом TAINA. Ромб живёт только в логотипе (решение владелицы, октябрь
// 2026): он и есть источник света сцены, вместо отдельного 3D-ромба.
export const LOGO_W = 3.4;
export const LOGO_H = (LOGO_W * 720) / 840;
/** На сколько ромб выше центра логотипа (в единицах сцены, до масштаба):
 *  центр ромба на картинке — y≈200 из 720. */
export const LOGO_GEM_Y = (LOGO_H * (360 - 200)) / 720;

export function buildLogo(imageUrl: string): LogoRig {
  const texture = new THREE.TextureLoader().load(imageUrl);
  // Как у кота (cat.ts / catMaterial.ts): сложение со сценой, чёрный фон
  // картинки ничего не добавляет — видно только золото и свет ромба.
  const material = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: texture }, uI: { value: 0 } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader,
    fragmentShader,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(LOGO_W, LOGO_H), material);

  const group = new THREE.Group();
  group.add(mesh);

  const haloA = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), createGlowMaterial(0xd81c22, 3.4, 0));
  const haloB = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 3.6),
    createGlowMaterial(0xff6a2a, 4.2, 0),
  );
  const halo = new THREE.Group();
  halo.add(haloA, haloB);

  return { group, material, halo, haloA, haloB };
}
