import * as THREE from 'three';
import vertexShader from '../shaders/diamond.vert.glsl?raw';
import fragmentShader from '../shaders/diamond.frag.glsl?raw';

export function createDiamondMaterial(
  uTime: { value: number },
  hT: number,
  hB: number,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime, uI: { value: 0 }, uHT: { value: hT }, uHB: { value: hB } },
    side: THREE.DoubleSide,
    vertexShader,
    fragmentShader,
  });
}
