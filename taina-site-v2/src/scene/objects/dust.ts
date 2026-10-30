import * as THREE from 'three';
import { createDustMaterial } from '../materials/dustMaterial';
import type { SharedUniforms } from '../uniforms';

export function buildDust(
  renderer: THREE.WebGLRenderer,
  uniforms: SharedUniforms,
  lowPower: boolean,
): THREE.Points {
  const N = lowPower ? 260 : 620;
  const p = new Float32Array(N * 3);
  const s = new Float32Array(N);
  let q = 7;
  const r = () => {
    q = (q * 16807) % 2147483647;
    return (q - 1) / 2147483646;
  };
  for (let i = 0; i < N; i++) {
    p[i * 3] = (r() * 2 - 1) * 13;
    p[i * 3 + 1] = -2.2 + r() * 8;
    p[i * 3 + 2] = -18 + r() * 20;
    s[i] = r();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(p, 3));
  geometry.setAttribute('aS', new THREE.BufferAttribute(s, 1));

  const material = createDustMaterial(renderer.getPixelRatio(), uniforms);
  const dust = new THREE.Points(geometry, material);
  dust.frustumCulled = false;
  return dust;
}
