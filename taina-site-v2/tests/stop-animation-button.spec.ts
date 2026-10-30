import { test, expect } from '@playwright/test';
import { waitForStageOn, waitForDebugLevel, readDebugOverlay, SLOW_RENDER_TIMEOUT } from './utils';

test.describe('Кнопка «Остановить анимацию» в подвале', () => {
  test.setTimeout(SLOW_RENDER_TIMEOUT * 2);

  test('останавливает сцену, запоминает состояние на сессию, текст остаётся на месте', async ({
    page,
  }) => {
    await page.goto('/?debug');
    await waitForStageOn(page);

    const button = page.locator('#motion-toggle');
    await expect(button).toHaveText('Остановить анимацию');
    await expect(button).toHaveAttribute('aria-pressed', 'false');

    await button.click();
    await expect(button).toHaveText('Возобновить анимацию');
    await expect(button).toHaveAttribute('aria-pressed', 'true');

    await waitForDebugLevel(page, ['C']);
    const overlay = await readDebugOverlay(page);
    expect(overlay).toContain('level: C');

    // sessionStorage должен запомнить состояние (переживает reload той
    // же вкладки/сессии, но не новую вкладку — это и есть «на время сессии»).
    const stored = await page.evaluate(() => sessionStorage.getItem('taina:animation-stopped'));
    expect(stored).toBe('1');

    // Текст остаётся на месте: пока анимация остановлена, реальный
    // скролл страницы не должен сдвигать копирайт хиро (сцена держит
    // состояние покоя, игнорируя p).
    const transformAtRest = await page.evaluate(
      () => document.getElementById('hero-copy')!.style.transform,
    );
    await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' as ScrollBehavior }));
    await page.waitForTimeout(500);
    const transformAfterScroll = await page.evaluate(
      () => document.getElementById('hero-copy')!.style.transform,
    );
    expect(transformAfterScroll).toBe(transformAtRest);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }));

    // Перезагрузка той же сессии — кнопка должна вспомнить состояние.
    await page.reload();
    await waitForStageOn(page);
    await expect(page.locator('#motion-toggle')).toHaveText('Возобновить анимацию');
    await expect(page.locator('#motion-toggle')).toHaveAttribute('aria-pressed', 'true');

    // Возобновляем — состояние снимается.
    await page.locator('#motion-toggle').click();
    await expect(page.locator('#motion-toggle')).toHaveText('Остановить анимацию');
    const storedAfter = await page.evaluate(() => sessionStorage.getItem('taina:animation-stopped'));
    expect(storedAfter).toBe('0');
  });
});
