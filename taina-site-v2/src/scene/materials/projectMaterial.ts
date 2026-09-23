import * as THREE from 'three';
import vertexShader from '../shaders/projectSheet.vert.glsl?raw';
import fragmentShader from '../shaders/projectSheet.frag.glsl?raw';

export function createProjectSheetMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uOrder: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide,
  });
}
