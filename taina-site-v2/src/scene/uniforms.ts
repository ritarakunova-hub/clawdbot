import * as THREE from 'three';

/**
 * Общие юниформы, на которые ссылаются несколько шейдеров (листы, пол, пыль).
 * Это те же объекты-обёртки {value}, что и в прототипе — обновление
 * .value в одном месте (кадровый цикл) сразу видно во всех материалах,
 * которые их держат.
 */
export interface SharedUniforms extends Record<string, THREE.IUniform> {
  uTime: THREE.IUniform<number>;
  uKeyPos: THREE.IUniform<THREE.Vector3>;
  uKeyI: THREE.IUniform<number>;
  uKeyR: THREE.IUniform<number>;
  uCurPos: THREE.IUniform<THREE.Vector3>;
  uCurI: THREE.IUniform<number>;
  uReveal: THREE.IUniform<number>;
  uPortrait: THREE.IUniform<number>;
}

export function createSharedUniforms(): SharedUniforms {
  return {
    uTime: { value: 0 },
    uKeyPos: { value: new THREE.Vector3() },
    uKeyI: { value: 0 },
    uKeyR: { value: 5.4 },
    uCurPos: { value: new THREE.Vector3(0, 0, -3) },
    uCurI: { value: 0 },
    uReveal: { value: 0 },
    uPortrait: { value: 0 },
  };
}
