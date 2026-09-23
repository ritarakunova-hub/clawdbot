import * as THREE from 'three';
import { createProjectSheetMaterial } from '../materials/projectMaterial';

export interface ProjectSheets {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
}

/**
 * «Хаос листов превращается в стеллаж» — один InstancedBufferGeometry:
 * у каждого листа своя случайная стартовая (хаос) и целевая (полка)
 * позиция/поворот плюс задержка (aDelay), а превращение считается на
 * GPU в вершинном шейдере по общему uOrder (см. projectSheet.vert.glsl).
 */
export function buildProjectSheets(lowPower: boolean): ProjectSheets {
  const rows = lowPower ? 3 : 4;
  const cols = lowPower ? 6 : 12;
  const N = rows * cols;

  const quad = new THREE.PlaneGeometry(0.78, 1.04);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = quad.index;
  geometry.setAttribute('position', quad.getAttribute('position'));
  geometry.setAttribute('uv', quad.getAttribute('uv'));

  const aChaosPos = new Float32Array(N * 3);
  const aChaosRot = new Float32Array(N * 3);
  const aShelfPos = new Float32Array(N * 3);
  const aShelfRot = new Float32Array(N * 3);
  const aDelay = new Float32Array(N);

  let seed = 11;
  const rnd = () => {
    seed = (seed * 48271) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const spacingX = 0.86;
  const spacingY = 1.32;
  // Сдвиг стеллажа вправо — слева остаётся место для подписи шага
  // (см. .reveal-title/.reveal-steps в Project.astro), без наложения.
  const shelfOffsetX = 2.1;

  for (let i = 0; i < N; i++) {
    aChaosPos[i * 3] = (rnd() * 2 - 1) * 5.4;
    aChaosPos[i * 3 + 1] = (rnd() * 2 - 1) * 3.2;
    aChaosPos[i * 3 + 2] = -2 - rnd() * 7;

    aChaosRot[i * 3] = (rnd() * 2 - 1) * 3.14;
    aChaosRot[i * 3 + 1] = (rnd() * 2 - 1) * 3.14;
    aChaosRot[i * 3 + 2] = (rnd() * 2 - 1) * 3.14;

    const row = Math.floor(i / cols);
    const col = i % cols;
    aShelfPos[i * 3] = (col - (cols - 1) / 2) * spacingX + shelfOffsetX;
    aShelfPos[i * 3 + 1] = (row - (rows - 1) / 2) * spacingY;
    aShelfPos[i * 3 + 2] = -5 + (rnd() * 2 - 1) * 0.08;

    aShelfRot[i * 3] = (rnd() * 2 - 1) * 0.03;
    aShelfRot[i * 3 + 1] = (rnd() * 2 - 1) * 0.03;
    aShelfRot[i * 3 + 2] = (rnd() * 2 - 1) * 0.03;

    aDelay[i] = rnd();
  }

  geometry.setAttribute('aChaosPos', new THREE.InstancedBufferAttribute(aChaosPos, 3));
  geometry.setAttribute('aChaosRot', new THREE.InstancedBufferAttribute(aChaosRot, 3));
  geometry.setAttribute('aShelfPos', new THREE.InstancedBufferAttribute(aShelfPos, 3));
  geometry.setAttribute('aShelfRot', new THREE.InstancedBufferAttribute(aShelfRot, 3));
  geometry.setAttribute('aDelay', new THREE.InstancedBufferAttribute(aDelay, 1));
  geometry.instanceCount = N;

  const material = createProjectSheetMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;

  return { mesh, material };
}
