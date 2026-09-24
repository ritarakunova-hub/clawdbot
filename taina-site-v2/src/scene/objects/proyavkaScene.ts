import * as THREE from 'three';
import { createProyavkaSheetMaterial, type ProyavkaUniforms } from '../materials/proyavkaMaterial';
import { createStreakMaterial } from '../materials/glow';

export interface ProyavkaObjects {
  sheet: THREE.Mesh;
  sheetMaterial: THREE.ShaderMaterial;
  frame: THREE.LineSegments;
  frameMaterial: THREE.LineBasicMaterial;
  stripes: THREE.Mesh[];
}

/**
 * Лист (проявляется по яркости) + рамка (глубже листа, слои 0,4/0,6 из
 * документа «Система движения») + три вертикальные полосы-мост в
 * «Три территории», раскрывающиеся в последние 15% скролла сцены.
 */
export function buildProyavkaObjects(uniforms: ProyavkaUniforms): ProyavkaObjects {
  const sheetGeometry = new THREE.PlaneGeometry(2.4, 3.2);
  const sheetMaterial = createProyavkaSheetMaterial(uniforms);
  const sheet = new THREE.Mesh(sheetGeometry, sheetMaterial);
  sheet.position.set(0, 0, -3.6);

  const frameGeometry = new THREE.PlaneGeometry(2.7, 3.5);
  const frameMaterial = new THREE.LineBasicMaterial({
    color: 0xd4af37,
    transparent: true,
    opacity: 0,
  });
  const frame = new THREE.LineSegments(new THREE.EdgesGeometry(frameGeometry, 1), frameMaterial);
  frame.position.set(0, 0, -4.2);

  const stripes: THREE.Mesh[] = [-1.4, 0, 1.4].map((x) => {
    const streak = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 9), createStreakMaterial(0xe22c34, 40, 2.4, 0));
    streak.position.set(x, 0, -3.2);
    return streak;
  });

  return { sheet, sheetMaterial, frame, frameMaterial, stripes };
}
