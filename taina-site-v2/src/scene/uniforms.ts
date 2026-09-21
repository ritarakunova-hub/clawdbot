import * as THREE from 'three';

/**
 * Общие юниформы, на которые ссылаются несколько шейдеров (листы, пол, пыль).
 * Это те же объекты-обёртки {value}, что и в прототипе — обновление
 * .value в одном месте (кадровый цикл) сразу видно во всех материалах,
 * которые их держат.
 */
export interface SharedUniforms {
  uTime: { value: number };
  uKeyPos: { value: THREE.Vector3 };
  uKeyI: { value: number };
  uKeyR: { value: number };
  uCurPos: { value: THREE.Vector3 };
  uCurI: { value: number };
  uReveal: { value: number };
  uPortrait: { value: number };
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
