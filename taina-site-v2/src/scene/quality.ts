import { isReducedMotion } from '@/lib/a11y';

export type QualityLevel = 'A' | 'B' | 'C';

let lowPowerDevice = false;
let webglAvailable = true;
let maxDpr = 2;
let dpr = 2;
let frameCount = 0;
let frameAcc = 0;

/** Вызывается один раз при монтировании сцены — задаёт стартовый DPR
 * и то, слабое ли устройство (телефон/мало ядер/маленький экран). */
export function initQuality(opts: { lowPower: boolean; webglAvailable: boolean }): void {
  lowPowerDevice = opts.lowPower;
  webglAvailable = opts.webglAvailable;
  maxDpr = lowPowerDevice ? 1.5 : 2;
  dpr = maxDpr;
  frameCount = 0;
  frameAcc = 0;
}

/**
 * Уровень всегда считается заново (не кэшируется) — reduced-motion
 * может включиться живьём в любой момент (ОС или кнопка «Остановить
 * анимацию»), и уровень должен тут же отразить это без перезагрузки.
 *
 * A — полный, B — телефон/слабое устройство, C — reduced-motion или нет WebGL2.
 */
export function getLevel(): QualityLevel {
  if (!webglAvailable || isReducedMotion()) return 'C';
  return lowPowerDevice ? 'B' : 'A';
}

export function getDpr(): number {
  return dpr;
}

/**
 * Копит время кадра; раз в 90 кадров пересчитывает DPR. Только вниз —
 * назад, к более высокому DPR, не поднимаем, как и просили.
 * dtSeconds — то же dt, что и в scene.update(p, dt).
 * Возвращает true, если DPR только что изменился (пора renderer.setPixelRatio + layout()).
 */
export function sampleFrameTime(dtSeconds: number): boolean {
  frameCount++;
  frameAcc += dtSeconds;
  if (frameCount < 90) return false;

  const avg = frameAcc / frameCount;
  frameCount = 0;
  frameAcc = 0;

  if (avg > 0.04 && dpr > 0.75) {
    dpr = 0.75;
    return true;
  }
  if (avg > 0.03 && dpr > 1) {
    dpr = Math.max(1, dpr - 0.5);
    return true;
  }
  return false;
}
