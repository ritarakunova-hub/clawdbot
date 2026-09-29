import { test, expect } from '@playwright/test';
import { waitForStageOn, readDebugOverlay, SLOW_RENDER_TIMEOUT } from './utils';

test.describe('Хиро ставится на паузу вне экрана и просыпается при возвращении', () => {
  test.setTimeout(SLOW_RENDER_TIMEOUT * 2);

  test('scene: hero пропадает из оверлея при скролле далеко вниз и возвращается обратно', async ({
    page,
  }) => {
    await page.goto('/?debug');
    await waitForStageOn(page);

    // Сцена рядом — оверлей должен показывать активную сцену "hero".
    await page.waitForFunction(
      () => document.getElementById('debug-overlay')?.textContent?.includes('scene: hero'),
      { timeout: SLOW_RENDER_TIMEOUT },
    );
    const beforeScroll = await readDebugOverlay(page);
    expect(beforeScroll).toContain('scene: hero');

    // Скроллим далеко за пределы hero (isNear() перестаёт быть true).
    await page.evaluate(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' as ScrollBehavior });
    });

    await page.waitForFunction(
      () => {
        const text = document.getElementById('debug-overlay')?.textContent ?? '';
        return text.includes('scene: —');
      },
      { timeout: SLOW_RENDER_TIMEOUT },
    );
    const farAway = await readDebugOverlay(page);
    expect(farAway).toContain('scene: —');

    // Возвращаемся наверх — сцена должна снова стать активной.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }));

    await page.waitForFunction(
      () => document.getElementById('debug-overlay')?.textContent?.includes('scene: hero'),
      { timeout: SLOW_RENDER_TIMEOUT },
    );
    const backOnTop = await readDebugOverlay(page);
    expect(backOnTop).toContain('scene: hero');
  });
});
