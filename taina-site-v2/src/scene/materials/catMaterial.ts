import * as THREE from 'three';
import vertexShader from '../shaders/billboard.vert.glsl?raw';
import fragmentShader from '../shaders/cat.frag.glsl?raw';

export function createCatMaterial(texture: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTex: { value: texture },
      uVis: { value: 0 },
      uBlink: { value: 0 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader,
    fragmentShader,
  });
}
