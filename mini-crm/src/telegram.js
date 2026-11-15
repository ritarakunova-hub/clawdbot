function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function shorten(value, maxLength) {
  const text = String(value || '');
  return text.length > maxLength ? text.slice(0, maxLength - 1) + '…' : text;
}

function formatLeadMessage(lead) {
  const lines = [
    '📩 <b>Новая заявка TAINA</b>',
    lead.name ? 'Имя: ' + escapeHtml(shorten(lead.name, 120)) : null,
    lead.phone ? 'Телефон: ' + escapeHtml(shorten(lead.phone, 48)) : null,
    lead.email ? 'Email: ' + escapeHtml(shorten(lead.email, 254)) : null,
    lead.message ? 'Запрос: ' + escapeHtml(shorten(lead.message, 500)) : null,
    lead.form_name ? 'Форма: ' + escapeHtml(shorten(lead.form_name, 120)) : null,
    lead.submission_id ? 'ID заявки: <code>' + escapeHtml(shorten(lead.submission_id, 128)) + '</code>' : null
  ].filter(Boolean);

  return lines.join('\n');
}

async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    throw new Error('Не заданы TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID');
  }

  const response = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    signal: AbortSignal.timeout(15000)
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Telegram API вернул некорректный ответ, HTTP ' + response.status);
  }

  if (!response.ok || !payload || payload.ok !== true) {
    throw new Error('Telegram API не подтвердил отправку, HTTP ' + response.status);
  }

  return payload.result;
}

async function notifyNewLead(lead) {
  return sendTelegramMessage(formatLeadMessage(lead));
}

module.exports = { notifyNewLead, formatLeadMessage, sendTelegramMessage };
