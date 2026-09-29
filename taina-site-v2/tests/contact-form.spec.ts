import { test, expect } from '@playwright/test';

test.describe('Форма заявки (taina-diagnostic)', () => {
  test('форма — статический HTML с нужными Netlify-атрибутами', async ({ page }) => {
    await page.goto('/');
    const form = page.locator('#diagnostic-form');
    await expect(form).toHaveAttribute('name', 'taina-diagnostic');
    await expect(form).toHaveAttribute('data-netlify', 'true');
    await expect(form).toHaveAttribute('netlify-honeypot', 'bot-field');
    await expect(page.locator('input[name="form-name"]')).toHaveValue('taina-diagnostic');
    await expect(page.locator('input[name="bot-field"]')).toBeAttached();
    await expect(page.locator('input[name="name"]')).toBeAttached();
    await expect(page.locator('input[name="contact"]')).toBeAttached();
    await expect(page.locator('textarea[name="message"]')).toBeAttached();
  });

  test('нельзя отправить без обязательных полей и без согласия', async ({ page }) => {
    await page.goto('/');
    await page.locator('#contact').scrollIntoViewIfNeeded();

    await page.click('#form-submit');
    const nameValidity = await page.evaluate(
      () => !(document.getElementById('f-name') as HTMLInputElement).checkValidity(),
    );
    expect(nameValidity).toBe(true);

    await page.fill('#f-name', 'Тест');
    await page.fill('#f-contact', '@test');
    await page.click('#form-submit');
    const consentValidity = await page.evaluate(
      () => !(document.getElementById('f-consent') as HTMLInputElement).checkValidity(),
    );
    expect(consentValidity).toBe(true);
  });

  test('выбранный пакет предзаполняет сообщение при заходе в форму', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => sessionStorage.setItem('taina:package', 'AI-пилот'));
    await page.reload();

    await expect(page.locator('#f-message')).toHaveValue(/AI-пилот/);
    await expect(page.locator('input[name="package"]')).toHaveValue('AI-пилот');
  });

  test('клавиатура проходит весь путь: поля, чекбокс, ссылки, отправка', async ({ page }) => {
    await page.goto('/');
    await page.locator('#f-name').focus();
    await page.keyboard.type('Клавиатурный тест');
    await page.keyboard.press('Tab');
    await page.keyboard.type('@kb');
    await page.keyboard.press('Tab');
    await page.keyboard.type('Сообщение');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    await expect(page.locator('#f-consent')).toBeChecked();

    await page.keyboard.press('Tab'); // ссылка на политику
    await page.keyboard.press('Tab'); // ссылка на оферту
    await page.keyboard.press('Tab'); // кнопка отправки
    await expect(page.locator('#form-submit')).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.locator('#form-status')).not.toHaveText('', { timeout: 10_000 });
  });

  test('ссылки согласия ведут на раскрытые тексты политики и оферты (черновик)', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="#legal-privacy"]');
    const privacy = page.locator('#legal-privacy');
    await expect(privacy).toBeVisible();
    await expect(privacy).toHaveJSProperty('open', true);
    await expect(privacy).toContainText('Политика в отношении обработки персональных данных');
    await expect(privacy).toContainText('Черновик для юридической проверки');
    await expect(privacy).toContainText('[ЗАПОЛНИТЬ при публикации');

    await page.click('a[href="#legal-offer"]');
    const offer = page.locator('#legal-offer');
    await expect(offer).toBeVisible();
    await expect(offer).toHaveJSProperty('open', true);
    await expect(offer).toContainText('Публичная оферта на оказание услуг');
    await expect(offer).toContainText('Черновик для юридической проверки');
    await expect(offer).toContainText('[ЗАПОЛНИТЬ при публикации');
  });
});
