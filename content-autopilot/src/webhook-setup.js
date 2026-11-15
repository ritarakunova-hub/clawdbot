const WEBHOOK_PATH = '/telegram/webhook';
const SECRET_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;

/**
 * Registers the Telegram webhook without putting the bot token or webhook
 * secret in shell arguments, command history, or the request query string.
 */
function validateWebhookUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('TELEGRAM_WEBHOOK_URL должен быть корректным URL');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Telegram webhook должен использовать HTTPS');
  }
  if (parsed.pathname !== WEBHOOK_PATH) {
    throw new Error('TELEGRAM_WEBHOOK_URL должен оканчиваться на ' + WEBHOOK_PATH);
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('TELEGRAM_WEBHOOK_URL не должен содержать логин, пароль, query или fragment');
  }

  return parsed.toString();
}

async function setTelegramWebhook({
  botToken,
  secretToken,
  webhookUrl,
  fetchImpl = global.fetch
}) {
  if (typeof botToken !== 'string' || !botToken.trim()) {
    throw new Error('Не задан TELEGRAM_BOT_TOKEN');
  }
  if (typeof secretToken !== 'string' || !SECRET_PATTERN.test(secretToken)) {
    throw new Error('TELEGRAM_WEBHOOK_SECRET должен содержать 32–256 символов: латинские буквы, цифры, "_" или "-"');
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('В этой версии Node.js недоступен fetch');
  }

  const safeWebhookUrl = validateWebhookUrl(webhookUrl);
  const endpoint = 'https://api.telegram.org/bot' + botToken + '/setWebhook';
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      url: safeWebhookUrl,
      secret_token: secretToken
    }),
    signal: AbortSignal.timeout(15000)
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Telegram API вернул невалидный JSON, HTTP ' + response.status);
  }

  if (!response.ok || !payload || payload.ok !== true) {
    const description = payload && payload.description
      ? String(payload.description)
      : 'неизвестная ошибка API';
    throw new Error('Не удалось зарегистрировать Telegram webhook (HTTP ' +
      response.status + '): ' + description);
  }

  return {
    ok: true,
    webhookUrl: new URL(safeWebhookUrl).origin + WEBHOOK_PATH
  };
}

module.exports = { setTelegramWebhook, validateWebhookUrl };
