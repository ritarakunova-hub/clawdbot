import * as THREE from 'three';

// three@0.147.0 закреплена точной версией (см. commit) именно для того, чтобы
// не решать проблему цвета вручную: в этой версии по умолчанию
// ColorManagement.legacyMode = true и renderer.outputEncoding = LinearEncoding —
// то есть вывод уже линейный, как ожидают шейдеры прототипа (finalPass сам
// делает тонмаппинг и гамму). Задаём это явно, а не полагаемся на дефолт,
// чтобы поведение не изменилось незаметно при апдейте патч-версии.
THREE.ColorManagement.legacyMode = true;

export class Unsupported extends Error {}

export function createHeroRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
  } catch {
    throw new Unsupported('WebGL context creation failed');
  }
  if (!renderer.capabilities.isWebGL2) {
    renderer.dispose();
    throw new Unsupported('WebGL2 is not available');
  }
  renderer.outputEncoding = THREE.LinearEncoding;
  renderer.setClearColor(0x030304, 1);
  return renderer;
}
