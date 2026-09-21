// Один requestAnimationFrame на весь сайт. Сцены подключаются как
// объекты { id, update(p, dt), isNear(p) } — обновляются только те,
// что isNear() считает достаточно близкими (заготовка под несколько
// сцен на странице, сейчас подключена только «Проявка»/хиро).

import * as scroll from './scroll';
import * as quality from './quality';

export interface SceneController {
  id: string;
  update(p: number, dt: number): void;
  isNear(p: number): boolean;
}

export interface FrameStats {
  frameMs: number;
  dt: number;
  activeSceneId: string | null;
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

  let activeSceneId: string | null = null;
  for (const scene of scenes.values()) {
    const rawP = scroll.getRawProgress(scene.id);
    if (!scene.isNear(rawP)) continue;
    activeSceneId = scene.id;
    scene.update(scroll.getSmoothedProgress(scene.id), dt);
  }

  // Пересчёт DPR — по dt (интервал между кадрами целиком, включая GPU),
  // а не по времени этого коллбэка, так честнее ловит просадки.
  quality.sampleFrameTime(dt);

  if (statsListeners.size > 0) {
    const frameMs = performance.now() - frameStart;
    const stats: FrameStats = { frameMs, dt, activeSceneId };
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
