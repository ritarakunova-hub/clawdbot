// Прогресс сцен из обычного скролла. Позиции секций читаются
// (getBoundingClientRect) только здесь, и только по событию ResizeObserver —
// не в кадровом цикле. Сам прогресс в цикле — это просто арифметика над
// уже посчитанными числами и window.scrollY/innerHeight (это не layout-чтения,
// а обычные свойства, они ничего не пересчитывают).

interface Target {
  element: HTMLElement;
  top: number;
  height: number;
  smoothed: number;
  observer: ResizeObserver;
}

const targets = new Map<string, Target>();

function measure(id: string): void {
  const target = targets.get(id);
  if (!target) return;
  const rect = target.element.getBoundingClientRect();
  target.top = rect.top + window.scrollY;
  target.height = rect.height;
}

export function registerTarget(id: string, element: HTMLElement): void {
  if (targets.has(id)) return;
  const rect = element.getBoundingClientRect();
  const observer = new ResizeObserver(() => measure(id));
  targets.set(id, {
    element,
    top: rect.top + window.scrollY,
    height: rect.height,
    smoothed: 0,
    observer,
  });
  observer.observe(element);
}

export function unregisterTarget(id: string): void {
  const target = targets.get(id);
  if (!target) return;
  target.observer.disconnect();
  targets.delete(id);
}

function rawProgress(target: Target): number {
  const total = Math.max(1, target.height - window.innerHeight);
  return (window.scrollY - target.top) / total;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Непосредственный прогресс, может быть <0 или >1 — для isNear(). */
export function getRawProgress(id: string): number {
  const target = targets.get(id);
  return target ? rawProgress(target) : 0;
}

/** Сглаженный прогресс 0..1 — то, что сцены получают в update(p, dt). */
export function getSmoothedProgress(id: string): number {
  return targets.get(id)?.smoothed ?? 0;
}

/** Границы секции в координатах документа — для loop.ts (активная/соседняя сцена). */
export function getBounds(id: string): { top: number; height: number } | undefined {
  const target = targets.get(id);
  return target ? { top: target.top, height: target.height } : undefined;
}

/**
 * Продвигает сглаживание для всех зарегистрированных целей.
 * k = 1 − 0.003^dt — не зависит от частоты кадров. Вызывается один раз
 * за кадр из loop.ts, до scene.update().
 */
export function tick(dt: number): void {
  const k = 1 - Math.pow(0.003, dt);
  for (const target of targets.values()) {
    const raw = clamp01(rawProgress(target));
    target.smoothed += (raw - target.smoothed) * k;
  }
}
