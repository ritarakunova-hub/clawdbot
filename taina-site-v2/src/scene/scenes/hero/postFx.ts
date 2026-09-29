import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import finalPassFragmentShader from '../../shaders/finalPass.frag.glsl?raw';
import billboardVertexShader from '../../shaders/billboard.vert.glsl?raw';

export interface PostFx {
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  finalPass: ShaderPass;
}

export function buildPostFx(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  lowPower: boolean,
): PostFx {
  const size = renderer.getSize(new THREE.Vector2());
  const renderTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType,
    samples: lowPower ? 0 : 4,
  });
  const composer = new EffectComposer(renderer, renderTarget);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.5, 0.6, 0.78);
  composer.addPass(bloom);

  const finalPass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uFade: { value: 0 },
      uFlash: { value: 0 },
      uExp: { value: 0.92 },
    },
    vertexShader: billboardVertexShader,
    fragmentShader: finalPassFragmentShader,
  });
  composer.addPass(finalPass);

  return { composer, bloom, finalPass };
}
