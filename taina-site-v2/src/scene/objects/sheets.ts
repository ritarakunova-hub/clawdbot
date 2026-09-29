import * as THREE from 'three';
import { createSheetMaterial } from '../materials/sheetMaterial';
import type { SharedUniforms } from '../uniforms';

const ATLAS_WORDS = [
  'бриф',
  'решение',
  'правка',
  'регламент',
  'договор',
  'версия 3',
  'финал_2',
  'согласовано?',
  'где файл?',
  'инструкция',
  'смета',
  'протокол',
  'правки клиента',
  'скинь ещё раз',
  'IMG_4821',
  'ТЗ',
];

function buildAtlas(renderer: THREE.WebGLRenderer): THREE.CanvasTexture {
  const CW = 256;
  const CH = 364;
  const cols = 4;
  const rows = 4;
  const canvas = document.createElement('canvas');
  canvas.width = CW * cols;
  canvas.height = CH * rows;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.globalCompositeOperation = 'lighter';

  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 16; i++) {
    const x = (i % cols) * CW;
    const y = Math.floor(i / cols) * CH;
    g.strokeStyle = 'rgb(0,0,255)';
    g.lineWidth = 2;
    g.strokeRect(x + 7, y + 7, CW - 14, CH - 14);
    g.fillStyle = 'rgb(0,255,0)';
    let ly = y + CH * 0.46;
    for (let k = 0; k < 11; k++) {
      const w = (CW - 64) * (0.45 + rnd() * 0.55);
      g.fillRect(x + 30, ly, w, 2.5);
      ly += 17;
    }
    g.fillRect(x + 30, y + CH * 0.09, 46, 3);
    g.fillStyle = 'rgb(255,0,0)';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let size = 58;
    const word = ATLAS_WORDS[i];
    g.font = `italic 500 ${size}px "Cormorant Garamond", Georgia, serif`;
    const mw = g.measureText(word).width;
    const maxW = CW - 44;
    if (mw > maxW) {
      size = Math.floor(size * (maxW / mw));
      g.font = `italic 500 ${size}px "Cormorant Garamond", Georgia, serif`;
    }
    g.fillText(word, x + CW / 2, y + CH * 0.27);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

export interface Sheets {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
}

/**
 * "Архив" плавающих листов-документов. Позиции — процедурные, с тем же
 * PRNG (LCG), что и в прототипе, чтобы раскладка листов совпадала кадр
 * в кадр с эталоном. diamondRest — снимок позиции покоя ромба на момент
 * постройки (в прототипе тоже разовый снимок D0, не живая ссылка).
 */
export function buildSheets(
  renderer: THREE.WebGLRenderer,
  uniforms: SharedUniforms,
  diamondRest: THREE.Vector3,
  lowPower: boolean,
): Sheets {
  const atlas = buildAtlas(renderer);
  const N = lowPower ? 96 : 180;
  const quad = new THREE.PlaneGeometry(1, 1.42);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = quad.index;
  geometry.setAttribute('position', quad.getAttribute('position'));
  geometry.setAttribute('uv', quad.getAttribute('uv'));

  const aPos = new Float32Array(N * 3);
  const aRot = new Float32Array(N * 3);
  const aSeed = new Float32Array(N * 4);
  const aCell = new Float32Array(N);

  let s = 13;
  const r = () => {
    s = (s * 48271) % 2147483647;
    return (s - 1) / 2147483646;
  };

  let n = 0;
  let guard = 0;
  while (n < N && guard++ < 5000) {
    const z = -26 + Math.pow(r(), 0.72) * 29;
    const x = (r() * 2 - 1) * (9 + (3 + -z) * 0.42);
    const y = -2.1 + Math.pow(r(), 1.25) * 7.4;
    if (z > -1.5 && Math.abs(x) < 1.6 && y > -1.5 && y < 1.8) continue;
    const dx = x - diamondRest.x;
    const dy = y - diamondRest.y;
    const dz = z - diamondRest.z;
    if (dx * dx + dy * dy * 0.6 + dz * dz < 3.2) continue;
    aPos[n * 3] = x;
    aPos[n * 3 + 1] = y;
    aPos[n * 3 + 2] = z;
    aRot[n * 3] = (r() * 2 - 1) * 0.9;
    aRot[n * 3 + 1] = (r() * 2 - 1) * 1.2;
    aRot[n * 3 + 2] = (r() * 2 - 1) * 3.14;
    aSeed[n * 4] = 0.3 + r() * 0.8;
    aSeed[n * 4 + 1] = 0.4 + r() * 1.0;
    aSeed[n * 4 + 2] = r() * 6.28;
    aSeed[n * 4 + 3] = 0.75 + r() * 0.85;
    aCell[n] = Math.floor(r() * 16);
    n++;
  }

  geometry.setAttribute('aPos', new THREE.InstancedBufferAttribute(aPos, 3));
  geometry.setAttribute('aRot', new THREE.InstancedBufferAttribute(aRot, 3));
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 4));
  geometry.setAttribute('aCell', new THREE.InstancedBufferAttribute(aCell, 1));
  geometry.instanceCount = n;

  const material = createSheetMaterial(atlas, uniforms);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;

  return { mesh, material };
}
