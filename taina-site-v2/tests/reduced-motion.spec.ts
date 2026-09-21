import { test, expect } from '@playwright/test';
import { waitForStageOn, waitForDebugLevel, readDebugOverlay, SLOW_RENDER_TIMEOUT } from './utils';

test.describe('prefers-reduced-motion', () => {
  test.setTimeout(SLOW_RENDER_TIMEOUT * 2);

  test('включён с самого начала — уровень качества C, заголовок читаемый сразу', async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/?debug');
    await waitForStageOn(page);
    await waitForDebugLevel(page, ['C']);

    const overlay = await readDebugOverlay(page);
    expect(overlay).toContain('level: C');

    // Заголовок должен быть полностью раскрыт (--s: 130%) сразу, без
    // ожидания 2.3-секундной развёртки — это и есть «статичный кадр».
    const sweep = await page.evaluate(() =>
      getComputedStyle(document.getElementById('hero-h1')!).getPropertyValue('--s'),
    );
    expect(parseFloat(sweep)).toBeGreaterThanOrEqual(129);

    expect(errors).toEqual([]);
    await context.close();
  });

  test('включается на лету — сцена останавливается на статичном кадре без перезагрузки', async ({
    page,
  }) => {
    await page.goto('/?debug');
    await waitForStageOn(page);

    // Стартуем с обычным движением — уровень не C (устройство в
    // песочнице определяется как lowPower, поэтому level: B).
    const before = await readDebugOverlay(page);
    expect(before).not.toContain('level: C');

    // Живое переключение ОС-настройки, без перезагрузки страницы.
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await waitForDebugLevel(page, ['C']);
    const after = await readDebugOverlay(page);
    expect(after).toContain('level: C');
  });
});
