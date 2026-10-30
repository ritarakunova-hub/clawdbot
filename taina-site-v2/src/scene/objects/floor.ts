import * as THREE from 'three';
import { createFloorMaterial } from '../materials/floorMaterial';

export function buildFloor(uKey: { value: THREE.Vector3 }): THREE.Mesh {
  const material = createFloorMaterial(uKey);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), material);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -2.45, -8);
  return floor;
}
