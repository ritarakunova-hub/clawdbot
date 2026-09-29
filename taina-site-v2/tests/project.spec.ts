import { test } from '@playwright/test';
import { waitForStageOn, SLOW_RENDER_TIMEOUT } from './utils';

test.describe('Сцены «Проект» и «Бегемот»', () => {
  test.setTimeout(SLOW_RENDER_TIMEOUT * 2);

  test('«Проект»: подписи шагов переключаются по ходу скролла, последний шаг — «Получили»', async ({
    page,
  }) => {
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

  test('«Проект»: reduced-motion сразу показывает собранный стеллаж и последний шаг', async ({ page }) => {
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

  test('«Бегемот»: фраза проявляется по ходу скролла', async ({ page }) => {
    await page.goto('/?debug');
    await waitForStageOn(page);

    const top = await page.evaluate(
      () => document.getElementById('behemoth-reveal')!.getBoundingClientRect().top + window.scrollY,
    );
    const height = await page.evaluate(() => document.getElementById('behemoth-reveal')!.offsetHeight);

    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top + height * 0.02);
    await page.waitForFunction(
      () => parseFloat(getComputedStyle(document.getElementById('behemoth-quote')!).opacity) < 0.1,
      { timeout: SLOW_RENDER_TIMEOUT },
    );

    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top + height * 0.9);
    await page.waitForFunction(
      () => parseFloat(getComputedStyle(document.getElementById('behemoth-quote')!).opacity) > 0.9,
      { timeout: SLOW_RENDER_TIMEOUT },
    );
  });

  test('«Бегемот»: reduced-motion сразу показывает фразу без ожидания скролла', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await waitForStageOn(page);

    const top = await page.evaluate(
      () => document.getElementById('behemoth-reveal')!.getBoundingClientRect().top + window.scrollY,
    );
    await page.evaluate((y) => window.scrollTo({ top: y + 40, behavior: 'instant' }), top);

    await page.waitForFunction(
      () => parseFloat(getComputedStyle(document.getElementById('behemoth-quote')!).opacity) > 0.9,
      { timeout: SLOW_RENDER_TIMEOUT },
    );
  });
});
