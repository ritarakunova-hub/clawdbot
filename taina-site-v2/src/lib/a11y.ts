// Единая точка правды: "движение включено или нет" — либо потому что
// пользователь так настроил ОС (prefers-reduced-motion), либо потому
// что он сам нажал «Остановить анимацию» в подвале. Оба источника
// отслеживаются живьём, без перезагрузки страницы.

const STORAGE_KEY = 'taina:animation-stopped';

const mql: MediaQueryList | null =
  typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

function readStoredStopped(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    // sessionStorage недоступен (приватный режим и т.п.) — считаем,
    // что пользователь ничего не останавливал.
    return false;
  }
}

let userStopped = typeof sessionStorage !== 'undefined' ? readStoredStopped() : false;

const listeners = new Set<() => void>();

function notify(): void {
  for (const cb of listeners) cb();
}

mql?.addEventListener('change', notify);

/** Живое состояние: движение должно быть остановлено (ОС ИЛИ кнопка). */
export function isReducedMotion(): boolean {
  return Boolean(mql?.matches) || userStopped;
}

export function isAnimationStoppedByUser(): boolean {
  return userStopped;
}

export function setAnimationStoppedByUser(stopped: boolean): void {
  userStopped = stopped;
  try {
    sessionStorage.setItem(STORAGE_KEY, stopped ? '1' : '0');
  } catch {
    // Не страшно — состояние просто не переживёт эту вкладку.
  }
  notify();
}

export function toggleAnimationStopped(): boolean {
  setAnimationStoppedByUser(!userStopped);
  return userStopped;
}

/** Подписка на любое изменение (ОС переключила prefers-reduced-motion
 * или пользователь нажал кнопку). Возвращает функцию отписки. */
export function onMotionChange(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
