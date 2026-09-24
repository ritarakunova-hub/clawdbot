import { test, expect } from '@playwright/test';
import { waitForStageOn, waitForDprBelow, readDebugOverlay, SLOW_RENDER_TIMEOUT } from './utils';

test.describe('Адаптивный DPR', () => {
  // CPU-троттлинг поверх и так небыстрого SwiftShader — самый долгий тест.
  test.setTimeout(SLOW_RENDER_TIMEOUT * 6);

  test('снижается при искусственно медленном кадре и не поднимается обратно', async ({
    page,
  }) => {
    await page.goto('/?debug');
    await waitForStageOn(page);

    const initial = await readDebugOverlay(page);
    const initialDpr = parseFloat(initial?.match(/dpr:\s*([\d.]+)/)?.[1] ?? 'NaN');
    expect(initialDpr).toBeGreaterThan(0.75);

    // Искусственно замедляем кадр через CPU-троттлинг (CDP) — честнее,
    // чем подделывать performance.now() внутри страницы.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    await waitForDprBelow(page, initialDpr, SLOW_RENDER_TIMEOUT * 4);
    const throttled = await readDebugOverlay(page);
    const throttledDpr = parseFloat(throttled?.match(/dpr:\s*([\d.]+)/)?.[1] ?? 'NaN');
    expect(throttledDpr).toBeLessThan(initialDpr);

    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

    // Даже после снятия троттлинга DPR не поднимается обратно вверх —
    // ждём немного и проверяем, что он не вырос.
    await page.waitForTimeout(3000);
    const afterRelease = await readDebugOverlay(page);
    const afterReleaseDpr = parseFloat(afterRelease?.match(/dpr:\s*([\d.]+)/)?.[1] ?? 'NaN');
    expect(afterReleaseDpr).toBeLessThanOrEqual(throttledDpr);
  });
});
