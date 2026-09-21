import type { Page } from '@playwright/test';

/**
 * Рендер в SwiftShader (программный WebGL2, без GPU) в песочнице
 * заметно медленнее реального железа — иногда несколько кадров в
 * секунду вместо 60. Поэтому везде ждём условие (waitForFunction), а
 * не фиксированное время, и даём щедрый timeout.
 */
export const SLOW_RENDER_TIMEOUT = 60_000;

export async function waitForStageOn(page: Page): Promise<void> {
  await page.waitForFunction(() => document.getElementById('hero-stage')?.classList.contains('on'), {
    timeout: SLOW_RENDER_TIMEOUT,
  });
}

export async function waitForSweepDone(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const h1 = document.getElementById('hero-h1');
      const raw = h1 && getComputedStyle(h1).getPropertyValue('--s');
      return raw ? parseFloat(raw) >= 129 : false;
    },
    { timeout: SLOW_RENDER_TIMEOUT },
  );
}

export function readDebugOverlay(page: Page): Promise<string | null> {
  return page.evaluate(() => document.getElementById('debug-overlay')?.textContent ?? null);
}

export function parseDebugOverlay(text: string | null): Record<string, string> {
  const result: Record<string, string> = {};
  if (!text) return result;
  for (const line of text.split('\n')) {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) result[key.trim()] = rest.join(':').trim();
  }
  return result;
}

/** Ждём, пока строка "level: X" в оверлее станет одной из ожидаемых. */
export async function waitForDebugLevel(page: Page, levels: string[]): Promise<void> {
  await page.waitForFunction(
    (levels) => {
      const text = document.getElementById('debug-overlay')?.textContent ?? '';
      const line = text.split('\n').find((l) => l.startsWith('level:'));
      const value = line?.slice('level:'.length).trim();
      return value ? levels.includes(value) : false;
    },
    levels,
    { timeout: SLOW_RENDER_TIMEOUT },
  );
}

/** Ждём, пока dpr в оверлее станет строго меньше порога. */
export async function waitForDprBelow(page: Page, threshold: number, timeout = SLOW_RENDER_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    (threshold) => {
      const text = document.getElementById('debug-overlay')?.textContent ?? '';
      const line = text.split('\n').find((l) => l.startsWith('dpr:'));
      const value = line ? parseFloat(line.slice('dpr:'.length)) : NaN;
      return !Number.isNaN(value) && value < threshold;
    },
    threshold,
    { timeout },
  );
}
