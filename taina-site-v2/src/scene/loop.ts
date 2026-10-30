// Один requestAnimationFrame и один общий холст на весь сайт. Сцены
// подключаются как объекты { id, prepare, dispose, update, render } —
// ровно одна сцена активна (её DOM-секция сейчас держит скролл) и
// рисуется, соседняя по порядку секций держится наготове (prepare +
// update, но без render), остальные освобождают GPU-ресурсы (dispose).

import * as scroll from './scroll';
import * as quality from './quality';

export interface SceneController {
  id: string;
  /** Идемпотентно строит GPU-ресурсы сцены, если их ещё нет. */
  prepare(): void;
  /** Идемпотентно освобождает GPU-ресурсы сцены. */
  dispose(): void;
  /** Обновляет состояние (юниформы, DOM) — только для активной и соседней сцены. */
  update(p: number, dt: number): void;
  /** Рисует кадр — только для активной сцены. */
  render(): void;
}

export interface FrameStats {
  frameMs: number;
  dt: number;
  activeSceneId: string | null;
  /** Сглаженный прогресс (0..1) активной сцены — для ?debug. */
  activeProgress: number | null;
}

const scenes = new Map<string, SceneController>();
const statsListeners = new Set<(stats: FrameStats) => void>();

let rafId = 0;
let lastTs = 0;
let running = false;

export function registerScene(scene: SceneController): void {
  scenes.set(scene.id, scene);
}

export function unregisterScene(id: string): void {
  scenes.delete(id);
}

export function onFrameStats(callback: (stats: FrameStats) => void): () => void {
  statsListeners.add(callback);
  return () => statsListeners.delete(callback);
}

/**
 * Активная сцена — та, чья секция в координатах документа сейчас
 * содержит scrollY (секции идут в потоке подряд, поэтому диапазоны не
 * пересекаются и без зазоров — это и убирает мерцание на стыке двух
 * 3D-сцен). Соседние по порядку секций — держим наготове (keep), чтобы
 * переключение было мгновенным. Дальние сцены — не в keep, освобождаются.
 */
function computeActiveAndKeep(): { active: string | null; keep: Set<string> } {
  const entries: { id: string; top: number; height: number }[] = [];
  for (const id of scenes.keys()) {
    const bounds = scroll.getBounds(id);
    if (bounds) entries.push({ id, ...bounds });
  }
  entries.sort((a, b) => a.top - b.top);

  const y = window.scrollY;
  let activeIndex = -1;
  for (let i = 0; i < entries.length; i++) {
    if (y >= entries[i].top && y < entries[i].top + entries[i].height) {
      activeIndex = i;
      break;
    }
  }

  const keep = new Set<string>();
  let active: string | null = null;
  if (activeIndex >= 0) {
    active = entries[activeIndex].id;
    keep.add(active);
    if (activeIndex > 0) keep.add(entries[activeIndex - 1].id);
    if (activeIndex < entries.length - 1) keep.add(entries[activeIndex + 1].id);
  }
  return { active, keep };
}

function frame(ts: number): void {
  rafId = requestAnimationFrame(frame);

  if (document.hidden) {
    lastTs = 0;
    return;
  }

  const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 1 / 60;
  lastTs = ts;
  const frameStart = performance.now();

  scroll.tick(dt);

  const { active, keep } = computeActiveAndKeep();
  for (const [id, scene] of scenes) {
    if (keep.has(id)) {
      scene.prepare();
      scene.update(scroll.getSmoothedProgress(id), dt);
    } else {
      scene.dispose();
    }
  }
  if (active) {
    scenes.get(active)?.render();
  }

  // Пересчёт DPR — по dt (интервал между кадрами целиком, включая GPU),
  // а не по времени этого коллбэка, так честнее ловит просадки.
  quality.sampleFrameTime(dt);

  if (statsListeners.size > 0) {
    const frameMs = performance.now() - frameStart;
    const activeProgress = active ? scroll.getSmoothedProgress(active) : null;
    const stats: FrameStats = { frameMs, dt, activeSceneId: active, activeProgress };
    for (const cb of statsListeners) cb(stats);
  }
}

export function start(): void {
  if (running) return;
  running = true;
  rafId = requestAnimationFrame(frame);
}

export function stop(): void {
  running = false;
  cancelAnimationFrame(rafId);
  lastTs = 0;
}
