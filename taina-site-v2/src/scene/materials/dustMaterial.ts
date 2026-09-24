import * as THREE from 'three';
import vertexShader from '../shaders/dust.vert.glsl?raw';
import fragmentShader from '../shaders/dust.frag.glsl?raw';
import type { SharedUniforms } from '../uniforms';

export function createDustMaterial(
  pixelRatio: number,
  uniforms: SharedUniforms,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: Object.assign({ uPx: { value: pixelRatio } }, uniforms),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader,
    fragmentShader,
  });
}
