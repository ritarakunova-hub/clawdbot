import * as THREE from 'three';

// three@0.147.0 закреплена точной версией (см. commit Этапа 3) именно для
// того, чтобы не решать проблему цвета вручную: в этой версии по умолчанию
// ColorManagement.legacyMode = true и renderer.outputEncoding = LinearEncoding —
// то есть вывод уже линейный, как ожидают шейдеры (finalPass сам делает
// тонмаппинг и гамму). Задаём явно, чтобы не зависеть от дефолта.
THREE.ColorManagement.legacyMode = true;

export class Unsupported extends Error {}

const CANVAS_ID = 'scene-gl';

let renderer: THREE.WebGLRenderer | null = null;
let contextLost = false;
/** Увеличивается при каждом восстановлении контекста — сцены сверяют со
 * своим снимком, чтобы понять, что GPU-ресурсы нужно пересобрать. */
let contextGeneration = 0;

const lostListeners = new Set<() => void>();
const restoredListeners = new Set<() => void>();

function getCanvasElement(): HTMLCanvasElement {
  const el = document.getElementById(CANVAS_ID);
  if (!(el instanceof HTMLCanvasElement)) {
    throw new Unsupported(`#${CANVAS_ID} canvas не найден в разметке`);
  }
  return el;
}

/**
 * Общий рендерер на один холст на весь сайт — создаётся один раз, лениво,
 * при первом обращении (первая сцена, которой он понадобился). Бросает
 * Unsupported, если WebGL2 недоступен вообще — вызывающий код ловит это
 * и включает CSS-заглушку для конкретной сцены.
 */
export function getSharedRenderer(): THREE.WebGLRenderer {
  if (renderer) return renderer;

  const canvas = getCanvasElement();
  let created: THREE.WebGLRenderer;
  try {
    created = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
  } catch {
    throw new Unsupported('WebGL context creation failed');
  }
  if (!created.capabilities.isWebGL2) {
    created.dispose();
    throw new Unsupported('WebGL2 is not available');
  }
  created.outputEncoding = THREE.LinearEncoding;
  created.setClearColor(0x030304, 1);

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); // разрешаем браузеру восстановить контекст позже
    contextLost = true;
    for (const cb of lostListeners) cb();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    contextGeneration++;
    for (const cb of restoredListeners) cb();
  });

  renderer = created;
  return created;
}

export function isContextLost(): boolean {
  return contextLost;
}

export function getContextGeneration(): number {
  return contextGeneration;
}

export function onContextLost(callback: () => void): () => void {
  lostListeners.add(callback);
  return () => lostListeners.delete(callback);
}

export function onContextRestored(callback: () => void): () => void {
  restoredListeners.add(callback);
  return () => restoredListeners.delete(callback);
}
