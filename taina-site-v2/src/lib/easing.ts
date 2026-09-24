// Кривые из документа «Система движения» (продублированы в CLAUDE.md).

export function clamp(x: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, x));
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** out = 1-(1-t)^3 */
export function easeOut(t: number): number {
  t = clamp(t, 0, 1);
  return 1 - Math.pow(1 - t, 3);
}

/** inOut = кубический in-out */
export function easeInOut(t: number): number {
  t = clamp(t, 0, 1);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** settle = easeOutBack(1,4) — только для входа ромба */
export function easeBack(t: number): number {
  t = clamp(t, 0, 1);
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
