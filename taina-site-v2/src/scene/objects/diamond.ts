import * as THREE from 'three';
import { createDiamondMaterial } from '../materials/diamondMaterial';
import { createGlowMaterial } from '../materials/glow';

export interface DiamondRig {
  /** Группа с самим ромбом (меш + рёбра) — двигается/масштабируется как одно целое. */
  group: THREE.Group;
  material: THREE.ShaderMaterial;
  edges: THREE.LineSegments;
  /** halo — отдельный объект сцены (билборд к камере), не ребёнок group. */
  halo: THREE.Group;
  haloA: THREE.Mesh;
  haloB: THREE.Mesh;
}

export function buildDiamond(uTime: { value: number }): DiamondRig {
  // Асимметричная бипирамида (крона выше основания) — значения откалиброваны
  // отдельно по официальному листу brand assets (docs/brand/), финал, не менять на глаз.
  const hT = 1.28;
  const hB = 0.98;
  const r = 0.74;
  const T = [0, hT, 0];
  const B = [0, -hB, 0];
  const E = [
    [r, 0, 0],
    [0, 0, r],
    [-r, 0, 0],
    [0, 0, -r],
  ];
  const pos: number[] = [];
  for (let i = 0; i < 4; i++) {
    const a = E[i];
    const b = E[(i + 1) % 4];
    pos.push(T[0], T[1], T[2], b[0], b[1], b[2], a[0], a[1], a[2]);
    pos.push(B[0], B[1], B[2], a[0], a[1], a[2], b[0], b[1], b[2]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.computeVertexNormals();

  const material = createDiamondMaterial(uTime, hT, hB);
  const mesh = new THREE.Mesh(geometry, material);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 1),
    // Золотой контур (Antique Gold) — вариант «Линия», выбран владелицей
    // в октябре 2026 вместо светлого ромба с бликом и лучами.
    new THREE.LineBasicMaterial({ color: 0xd4af37, transparent: true, opacity: 1 }),
  );
  mesh.add(edges);

  const group = new THREE.Group();
  group.add(mesh);

  const haloA = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), createGlowMaterial(0xd81c22, 3.4, 0));
  const haloB = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 3.6),
    createGlowMaterial(0xff6a2a, 4.2, 0),
  );
  const halo = new THREE.Group();
  halo.add(haloA, haloB);

  return { group, material, edges, halo, haloA, haloB };
}
