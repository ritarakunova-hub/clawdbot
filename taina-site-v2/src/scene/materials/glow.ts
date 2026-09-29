import * as THREE from 'three';
import vertexShader from '../shaders/billboard.vert.glsl?raw';
import glowFragmentShader from '../shaders/glow.frag.glsl?raw';
import streakFragmentShader from '../shaders/streak.frag.glsl?raw';

export function createGlowMaterial(
  color: THREE.ColorRepresentation,
  pow: number,
  intensity: number,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uCol: { value: new THREE.Color(color) },
      uI: { value: intensity },
      uPow: { value: pow },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader,
    fragmentShader: glowFragmentShader,
  });
}

export function createStreakMaterial(
  color: THREE.ColorRepresentation,
  thickness: number,
  falloff: number,
  intensity: number,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uCol: { value: new THREE.Color(color) },
      uI: { value: intensity },
      uT: { value: thickness },
      uF: { value: falloff },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader,
    fragmentShader: streakFragmentShader,
  });
}
