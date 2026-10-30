import * as THREE from 'three';
import vertexShader from '../shaders/floor.vert.glsl?raw';
import fragmentShader from '../shaders/floor.frag.glsl?raw';

export function createFloorMaterial(uKey: { value: THREE.Vector3 }): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uKey, uI: { value: 0 } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader,
    fragmentShader,
  });
}
