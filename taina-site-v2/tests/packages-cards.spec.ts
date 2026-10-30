import { test, expect } from '@playwright/test';

test.describe('Пакеты: наклон карточки, светлое пятно, нажатие', () => {
  test('наклон меняется по положению курсора и сбрасывается при уходе', async ({ page }) => {
    await page.goto('/');
    await page.locator('#packages-grid').scrollIntoViewIfNeeded();

    const card = page.locator('#packages-grid .card').nth(1);
    const box = (await card.boundingBox())!;

    await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.1, { steps: 5 });
    const topLeft = await card.evaluate((el) => el.style.transform);
    expect(topLeft).toContain('rotateX');
    const topLeftX = parseFloat(topLeft.match(/rotateX\(([-\d.]+)deg\)/)![1]);
    expect(Math.abs(topLeftX)).toBeLessThanOrEqual(4);
    expect(Math.abs(topLeftX)).toBeGreaterThan(0);

    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.9, { steps: 5 });
    const bottomRight = await card.evaluate((el) => el.style.transform);
    const bottomRightX = parseFloat(bottomRight.match(/rotateX\(([-\d.]+)deg\)/)![1]);
    // Наклон должен переворачиваться между противоположными углами.
    expect(Math.sign(bottomRightX)).not.toBe(Math.sign(topLeftX));

    await page.mouse.move(50, 50);
    await expect(card).toHaveJSProperty('style.transform', '');
  });

  test('нажатие уменьшает карточку за 90мс, отпускание возвращает', async ({ page }) => {
    await page.goto('/');
    await page.locator('#packages-grid').scrollIntoViewIfNeeded();

    const card = page.locator('#packages-grid .card').nth(1);
    const box = (await card.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5, { steps: 5 });

    await page.mouse.down();
    await expect(card).toHaveJSProperty('style.transitionDuration', '90ms');
    // transform пишется через requestAnimationFrame (не чаще раза за
    // кадр) — ждём, пока отрисуется, а не читаем синхронно сразу.
    await page.waitForFunction(() => {
      const el = document.querySelectorAll('#packages-grid .card')[1] as HTMLElement;
      return el.style.transform.includes('scale(0.985)');
    });

    await page.mouse.up();
    await expect(card).toHaveJSProperty('style.transitionDuration', '');
  });

  test('reduced-motion отключает наклон и сжатие при нажатии', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.locator('#packages-grid').scrollIntoViewIfNeeded();

    const card = page.locator('#packages-grid .card').nth(1);
    const box = (await card.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.1, { steps: 5 });
    await expect(card).toHaveJSProperty('style.transform', '');

    await page.mouse.down();
    await page.waitForFunction(() => {
      const el = document.querySelectorAll('#packages-grid .card')[1] as HTMLElement;
      return el.style.transform.length > 0;
    });
    const pressed = await card.evaluate((el) => el.style.transform);
    expect(pressed).toContain('scale(1)');
    expect(pressed).not.toContain('scale(0.985)');
    await page.mouse.up();
  });
});
