import * as THREE from 'three';
import { createCatMaterial } from '../materials/catMaterial';

export interface Cat {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
}

export function buildCat(imageUrl: string): Cat {
  const texture = new THREE.TextureLoader().load(imageUrl);
  const material = createCatMaterial(texture);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), material);
  return { mesh, material };
}
