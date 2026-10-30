import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { waitForStageOn, SLOW_RENDER_TIMEOUT } from './utils';

// Даём axe-core проверить весь путь по CLAUDE.md (Этап 13): не только
// первый экран, а состояния, до которых обычно не добираются —
// раскрытая карточка территории, открытый чат демо, заполненная форма,
// мобильный вьюпорт. canvas у нас aria-hidden, поэтому его axe не видит —
// это осознанно (весь смысл сцен продублирован в обычном DOM).

/**
 * Перед сканированием глушим CSS-переходы/анимации: иначе axe иногда
 * снимает DOM ровно в кадре, где .data-reveal ещё на середине перехода
 * opacity 0→1 (например, сразу после scrollIntoView по соседней секции),
 * и репортит «недостаточный контраст» для текста, который через доли
 * секунды и так станет полностью читаемым — это гонка со временем теста,
 * а не реальная ошибка вёрстки (итоговые контрасты уже проверены
 * npm run contrast и скриншотами). Проверяем финальное состояние, не
 * промежуточный кадр перехода.
 */
async function analyzeSettled(page: Page) {
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
  });
  return new AxeBuilder({ page }).analyze();
}

test.describe('Доступность (axe-core)', () => {
  test.setTimeout(SLOW_RENDER_TIMEOUT * 2);

  test('главная страница, десктоп 1440px', async ({ page }) => {
    await page.goto('/');
    await waitForStageOn(page);
    const results = await analyzeSettled(page);
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test('раскрытая карточка территории', async ({ page }) => {
    await page.goto('/');
    await waitForStageOn(page);
    await page.evaluate(() => document.getElementById('territories')!.scrollIntoView());
    await page.locator('.frame[data-territory="systems"]').click();
    await expect(page.locator('#territories-expanded')).toBeVisible();
    const results = await analyzeSettled(page);
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test('демо-чат с ответом на экране', async ({ page }) => {
    await page.goto('/');
    await page.locator('#demo-chat').scrollIntoViewIfNeeded();
    await page.locator('.chip', { hasText: 'Сколько стоит внедрение?' }).click();
    await expect(page.locator('#demo-chat-answer .a')).toBeVisible({ timeout: 15_000 });
    const results = await analyzeSettled(page);
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test('форма заявки — пустая и с ошибкой валидации', async ({ page }) => {
    await page.goto('/');
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await page.click('#form-submit');
    const results = await analyzeSettled(page);
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test('мобильный вьюпорт 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const results = await analyzeSettled(page);
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test('reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const results = await analyzeSettled(page);
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});
