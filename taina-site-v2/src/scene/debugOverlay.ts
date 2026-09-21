import { onFrameStats } from './loop';
import { getLevel, getDpr } from './quality';

/**
 * Оверлей ?debug: время кадра, DPR, уровень качества, активная сцена.
 * Без ?debug в адресе элемент даже не создаётся — ничего в DOM не остаётся.
 */
export function initDebugOverlay(): void {
  if (typeof location === 'undefined') return;
  if (!new URLSearchParams(location.search).has('debug')) return;

  const el = document.createElement('div');
  el.id = 'debug-overlay';
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = [
    'position:fixed',
    'right:8px',
    'bottom:8px',
    'z-index:9999',
    'padding:8px 10px',
    'background:rgba(0,0,0,.75)',
    'color:#8f8',
    'font:12px/1.5 ui-monospace,monospace',
    'white-space:pre',
    'pointer-events:none',
    'border-radius:4px',
  ].join(';');
  document.body.appendChild(el);

  const render = (frameMs: number, activeSceneId: string | null) => {
    el.textContent =
      `frame: ${frameMs.toFixed(1)} ms\n` +
      `dpr: ${getDpr().toFixed(2)}\n` +
      `level: ${getLevel()}\n` +
      `scene: ${activeSceneId ?? '—'}`;
  };

  render(0, null);
  onFrameStats(({ dt, activeSceneId }) => render(dt * 1000, activeSceneId));
}
