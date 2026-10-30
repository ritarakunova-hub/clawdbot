import { test, expect } from '@playwright/test';
import { waitForStageOn, SLOW_RENDER_TIMEOUT } from './utils';

test.describe('Сцена «Три территории»', () => {
  test.setTimeout(SLOW_RENDER_TIMEOUT * 2);

  test('скролл-скраб двигает плёнку и подсвечивает активный кадр', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await waitForStageOn(page);

    const top = await page.evaluate(
      () => document.getElementById('territories')!.getBoundingClientRect().top + window.scrollY,
    );
    const height = await page.evaluate(() => document.getElementById('territories')!.offsetHeight);

    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top + height * 0.02);
    await page.waitForTimeout(1200);
    const startTransform = await page.evaluate(
      () => document.getElementById('territories-strip')!.style.transform,
    );

    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top + height * 0.9);
    await page.waitForTimeout(1200);
    const endTransform = await page.evaluate(
      () => document.getElementById('territories-strip')!.style.transform,
    );

    expect(startTransform).not.toBe(endTransform);

    // Фон секции непрозрачный — не пропускает холст 3D-сцен позади.
    const bg = await page.evaluate(
      () => getComputedStyle(document.getElementById('territories')!).backgroundColor,
    );
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('клик по кадру раскрывает его на весь экран и запоминает выбор', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await waitForStageOn(page);

    await page.evaluate(() => document.getElementById('territories')!.scrollIntoView());
    const frame = page.locator('.frame[data-territory="systems"]');
    await frame.click();

    await expect(page.locator('#territories-expanded')).toBeVisible();
    await expect(page.locator('#territories-expanded-title')).toHaveText('Системы');

    const href = await page.locator('#territories-expanded-cta').getAttribute('href');
    expect(href).toBe('#contact');

    const stored = await page.evaluate(() => sessionStorage.getItem('taina:territory'));
    expect(stored).toBe('systems');

    await page.keyboard.press('Escape');
    await expect(page.locator('#territories-expanded')).toBeHidden();
  });

  test('мобильная раскладка: карточки в столбик, без затемнения и скраба', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const top = await page.evaluate(
      () => document.getElementById('territories')!.getBoundingClientRect().top + window.scrollY,
    );
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top + 50);
    await page.waitForTimeout(1200);

    const transform = await page.evaluate(
      () => document.getElementById('territories-strip')!.style.transform,
    );
    expect(transform).toBe('none');

    const dim = await page.evaluate(
      () => getComputedStyle(document.querySelector('.frame .dim')!).opacity,
    );
    expect(dim).toBe('0');

    // Регресс: .hit (кнопка-карточка) внутри .frame с height: auto
    // схлопывалась в 0 (height: 100% не резолвится от auto-родителя),
    // из-за чего .copy (position: absolute; bottom: 0) рисовался выше
    // видимой области и обрезался overflow: hidden — заголовок и текст
    // карточки были в DOM, но никогда не попадали в кадр. Проверяем не
    // «хоть один пиксель пересёкся» (при баге верх .frame и низ .copy
    // касаются в одной точке — формальное пересечение есть), а что
    // видимая часть текста — это реально большая доля его высоты.
    const overlapRatio = await page.evaluate(() => {
      const frame = document.querySelector('.frame')!.getBoundingClientRect();
      const copy = document.querySelector('.frame .copy')!.getBoundingClientRect();
      const overlap = Math.min(frame.bottom, copy.bottom) - Math.max(frame.top, copy.top);
      return Math.max(0, overlap) / copy.height;
    });
    expect(overlapRatio).toBeGreaterThan(0.9);
  });
});
