import * as THREE from 'three';
import vertexShader from '../shaders/sheets.vert.glsl?raw';
import fragmentShader from '../shaders/sheets.frag.glsl?raw';
import type { SharedUniforms } from '../uniforms';

export function createSheetMaterial(
  atlas: THREE.Texture,
  uniforms: SharedUniforms,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: Object.assign({ uAtlas: { value: atlas } }, uniforms) as unknown as Record<
      string,
      THREE.IUniform
    >,
    side: THREE.DoubleSide,
    vertexShader,
    fragmentShader,
  });
}
