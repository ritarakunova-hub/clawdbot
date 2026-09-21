import * as THREE from 'three';
import { createDiamondMaterial } from '../materials/diamondMaterial';
import { createGlowMaterial, createStreakMaterial } from '../materials/glow';

export interface DiamondRig {
  /** Группа с самим ромбом (меш + рёбра) — двигается/масштабируется как одно целое. */
  group: THREE.Group;
  material: THREE.ShaderMaterial;
  edges: THREE.LineSegments;
  /** halo и полосы — отдельные объекты сцены (билборды к камере), не дети group. */
  halo: THREE.Group;
  haloA: THREE.Mesh;
  haloB: THREE.Mesh;
  streakH: THREE.Mesh;
  streakV: THREE.Mesh;
}

export function buildDiamond(uTime: { value: number }): DiamondRig {
  const h = 1.15;
  const r = 0.72; // ширина ромба влево-вправо — видна всегда, задаёт силуэт
  // Плоская масть «бубны» из игральных карт, а не объёмный камень: глубина
  // (вперёд-назад) намного меньше ширины, поэтому при повороте ромб не
  // раскрывается в большой объёмный шип, а остаётся тонкой гранёной пластиной.
  const rz = 0.16;
  const T = [0, h, 0];
  const B = [0, -h, 0];
  const E = [
    [r, 0, 0],
    [0, 0, rz],
    [-r, 0, 0],
    [0, 0, -rz],
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

  const material = createDiamondMaterial(uTime);
  const mesh = new THREE.Mesh(geometry, material);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 1),
    new THREE.LineBasicMaterial({ color: 0xffc24a, transparent: true, opacity: 0.7 }),
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

  const streakH = new THREE.Mesh(
    new THREE.PlaneGeometry(17, 0.5),
    createStreakMaterial(0xffb08a, 30, 2.2, 0),
  );
  // Вертикальная полоса в прототипе — та же геометрия толщины 0.5,
  // но развёрнутая (7.5×0.5) и повёрнутая на 90°, а не квадрат 0.5×7.5.
  const streakV = new THREE.Mesh(
    new THREE.PlaneGeometry(7.5, 0.5),
    createStreakMaterial(0xff9a80, 30, 2.6, 0),
  );
  streakV.rotation.z = Math.PI / 2;

  return { group, material, edges, halo, haloA, haloB, streakH, streakV };
}
