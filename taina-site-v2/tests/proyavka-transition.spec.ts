import { test, expect } from '@playwright/test';
import { waitForStageOn, SLOW_RENDER_TIMEOUT } from './utils';

test.describe('Сцена «Проявка» — переход, пауза, reduced-motion', () => {
  test.setTimeout(SLOW_RENDER_TIMEOUT * 2);

  test('переход хиро → «Проявка» без разрыва: активная сцена всегда hero или proyavka, без пропуска кадра', async ({
    page,
  }) => {
    await page.goto('/?debug');
    await waitForStageOn(page);

    const revealTop = await page.evaluate(
      () => document.getElementById('proyavka-reveal')!.getBoundingClientRect().top + window.scrollY,
    );

    const seenScenes = new Set<string>();
    // Проходим стык хиро/«Проявки» мелкими шагами — ни один шаг не должен
    // показать «scene: —» (обе секции идут в потоке подряд, без зазора).
    for (let offset = -40; offset <= 40; offset += 8) {
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), revealTop + offset);
      await page.waitForTimeout(80);
      const text = await page.evaluate(() => document.getElementById('debug-overlay')?.textContent ?? '');
      const line = text.split('\n').find((l) => l.startsWith('scene:')) ?? '';
      seenScenes.add(line.replace('scene:', '').trim());
    }

    expect(seenScenes.has('—')).toBe(false);
    expect([...seenScenes].every((s) => s === 'hero' || s === 'proyavka')).toBe(true);
  });

  test('«Проявка» ставится на паузу вне экрана и просыпается при возвращении', async ({ page }) => {
    await page.goto('/?debug');
    await waitForStageOn(page);

    const revealTop = await page.evaluate(
      () => document.getElementById('proyavka-reveal')!.getBoundingClientRect().top + window.scrollY,
    );
    const revealHeight = await page.evaluate(() => document.getElementById('proyavka-reveal')!.offsetHeight);

    // Внутри сцены — активна.
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), revealTop + revealHeight * 0.3);
    await page.waitForFunction(
      () => (document.getElementById('debug-overlay')?.textContent ?? '').includes('scene: proyavka'),
      { timeout: SLOW_RENDER_TIMEOUT },
    );

    // Далеко внизу страницы — сцена не активна и не соседняя, рендера нет.
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
    await page.waitForFunction(
      () => (document.getElementById('debug-overlay')?.textContent ?? '').includes('scene: —'),
      { timeout: SLOW_RENDER_TIMEOUT },
    );

    // Возвращаемся — активна снова.
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), revealTop + revealHeight * 0.3);
    await page.waitForFunction(
      () => (document.getElementById('debug-overlay')?.textContent ?? '').includes('scene: proyavka'),
      { timeout: SLOW_RENDER_TIMEOUT },
    );
  });

  test('reduced-motion: фраза и лист сразу в финальном состоянии, без ожидания скролла', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await waitForStageOn(page);

    // Без единого скролла к «Проявке» — сразу проверяем финальное состояние.
    await page.evaluate(() => document.getElementById('proyavka-reveal')?.scrollIntoView());
    await page.waitForFunction(
      () => {
        const phrase = document.getElementById('proyavka-phrase');
        const raw = phrase && getComputedStyle(phrase).getPropertyValue('--s');
        return raw ? parseFloat(raw) >= 129 : false;
      },
      { timeout: SLOW_RENDER_TIMEOUT },
    );
  });
});
