import * as THREE from 'three';
import vertexShader from '../shaders/proyavkaSheet.vert.glsl?raw';
import fragmentShader from '../shaders/proyavkaSheet.frag.glsl?raw';

export interface ProyavkaUniforms extends Record<string, THREE.IUniform> {
  uReveal: THREE.IUniform<number>;
  uTime: THREE.IUniform<number>;
}

export function createProyavkaUniforms(): ProyavkaUniforms {
  return {
    uReveal: { value: 0 },
    uTime: { value: 0 },
  };
}

export function createProyavkaSheetMaterial(uniforms: ProyavkaUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms,
    side: THREE.DoubleSide,
    vertexShader,
    fragmentShader,
  });
}
