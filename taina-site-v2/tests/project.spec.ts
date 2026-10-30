import { test } from '@playwright/test';
import { waitForStageOn, SLOW_RENDER_TIMEOUT } from './utils';

test.describe('Сцена «Проект»', () => {
  test.setTimeout(SLOW_RENDER_TIMEOUT * 2);

  test('подписи шагов переключаются по ходу скролла, последний шаг — «Получили»', async ({ page }) => {
    await page.goto('/?debug');
    await waitForStageOn(page);

    const top = await page.evaluate(
      () => document.getElementById('project-reveal')!.getBoundingClientRect().top + window.scrollY,
    );
    const height = await page.evaluate(() => document.getElementById('project-reveal')!.offsetHeight);

    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top + height * 0.02);
    await page.waitForFunction(
      () => document.querySelector('#project-steps .reveal-step.is-active .k')?.textContent === 'Задача',
      { timeout: SLOW_RENDER_TIMEOUT },
    );

    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top + height * 0.98);
    await page.waitForFunction(
      () => document.querySelector('#project-steps .reveal-step.is-active .k')?.textContent === 'Получили',
      { timeout: SLOW_RENDER_TIMEOUT },
    );
  });

  test('reduced-motion сразу показывает последний шаг', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await waitForStageOn(page);

    const top = await page.evaluate(
      () => document.getElementById('project-reveal')!.getBoundingClientRect().top + window.scrollY,
    );
    // Небольшой отступ от точной верхней границы секции — scrollIntoView/
    // scrollTo на точный дробный top иногда не попадает в диапазон секции
    // из-за округления window.scrollY до целого пикселя (проверено на
    // практике при верификации этой сцены — не связано с самой логикой).
    await page.evaluate((y) => window.scrollTo({ top: y + 40, behavior: 'instant' }), top);

    await page.waitForFunction(
      () => document.querySelector('#project-steps .reveal-step.is-active .k')?.textContent === 'Получили',
      { timeout: SLOW_RENDER_TIMEOUT },
    );
  });
});
