/**
 * Отправка уведомлений в Telegram через Bot API.
 * Используется встроенный fetch (Node 18+) — отдельная библиотека не нужна.
 */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Собирает текст уведомления о новой заявке.
 */
function formatLeadMessage(lead) {
  const lines = [
    '📩 <b>Новая заявка с сайта</b>',
    lead.name ? `Имя: ${escapeHtml(lead.name)}` : null,
    lead.phone ? `Телефон: ${escapeHtml(lead.phone)}` : null,
    lead.email ? `Email: ${escapeHtml(lead.email)}` : null,
    lead.message ? `Сообщение: ${escapeHtml(lead.message)}` : null,
    lead.form_name ? `Форма: ${escapeHtml(lead.form_name)}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}

async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    throw new Error(
      'Не заданы переменные окружения TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID'
    );
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API вернул ${res.status}: ${body}`);
  }

  return res.json();
}

/**
 * Уведомляет о новой заявке. Если Telegram недоступен — бросает ошибку,
 * но заявка к этому моменту уже сохранена в Google Sheets, поэтому
 * вызывающий код не должен ронять весь запрос из-за этого.
 */
async function notifyNewLead(lead) {
  const text = formatLeadMessage(lead);
  await sendTelegramMessage(text);
}

module.exports = { notifyNewLead, formatLeadMessage, sendTelegramMessage };
