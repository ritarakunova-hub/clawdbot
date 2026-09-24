import { test, expect } from '@playwright/test';

test.describe('Демо: интерактивный чат в mock-режиме', () => {
  test('клик по чипу с известным вопросом показывает настоящий ответ с источником', async ({ page }) => {
    await page.goto('/');
    await page.locator('#demo-chat').scrollIntoViewIfNeeded();

    await page.locator('.chip', { hasText: 'Сколько стоит внедрение?' }).click();
    await expect(page.locator('#demo-chat-input')).toHaveValue('Сколько стоит внедрение?');

    await expect(page.locator('#demo-chat-answer .a')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#demo-chat-answer .a')).not.toHaveClass(/a--refusal/);
    await expect(page.locator('#demo-chat-answer .tag')).toHaveText('Источник: тарифы TAINA');
  });

  test('вопрос вне базы знаний честно отвечает «не нашлось», а не выдумывает', async ({ page }) => {
    await page.goto('/');
    await page.locator('#demo-chat').scrollIntoViewIfNeeded();

    await page.fill('#demo-chat-input', 'Какая погода на Марсе?');
    await page.click('.chat-submit');

    const refusal = page.locator('#demo-chat-answer .a--refusal');
    await expect(refusal).toBeVisible({ timeout: 15_000 });
    await expect(refusal).toContainText('такой информации нет');
  });

  test('весь сценарий проходится с клавиатуры: фокус, Enter, ответ', async ({ page }) => {
    await page.goto('/');
    await page.locator('#demo-chat').scrollIntoViewIfNeeded();

    const input = page.locator('#demo-chat-input');
    await input.focus();
    await input.fill('В чём разница между пилотом и системой?');
    await page.keyboard.press('Enter');

    await expect(page.locator('#demo-chat-answer .a')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#demo-chat-answer .a')).not.toHaveClass(/a--refusal/);
  });

  test('во время ответа повторная отправка заблокирована (защита от спама)', async ({ page }) => {
    await page.goto('/');
    await page.locator('#demo-chat').scrollIntoViewIfNeeded();

    await page.locator('.chip', { hasText: 'Сколько стоит внедрение?' }).click();
    await expect(page.locator('.chat-submit')).toBeDisabled();
    await expect(page.locator('.chat-submit')).toBeEnabled({ timeout: 15_000 });
  });
});
