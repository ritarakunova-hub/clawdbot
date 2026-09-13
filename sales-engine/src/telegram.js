function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function apiUrl(method) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Не задана переменная окружения TELEGRAM_BOT_TOKEN');
  return `https://api.telegram.org/bot${token}/${method}`;
}

async function callTelegram(method, payload) {
  const res = await fetch(apiUrl(method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API (${method}) вернул ${res.status}: ${body}`);
  }
  return res.json();
}

function getChatId() {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error('Не задана переменная окружения TELEGRAM_CHAT_ID');
  return chatId;
}

/**
 * Собирает текст карточки лида — то, что видит человек в Telegram.
 */
function formatLeadCard(lead) {
  return [
    `🎯 <b>Новый лид</b> — score ${lead.score}/100`,
    '',
    `<b>Компания:</b> ${escapeHtml(lead.company)}`,
    `Ниша: ${escapeHtml(lead.niche)} · Город: ${escapeHtml(lead.city)}`,
    lead.domain ? `Сайт: ${escapeHtml(lead.domain)}` : 'Сайт: —',
    `Контакт: ${escapeHtml(lead.contacts) || '—'}`,
    '',
    `<b>Почему интересна:</b>\n${escapeHtml(lead.score_reason)}`,
    '',
    `<b>Возможная проблема:</b>\n${escapeHtml(lead.problem)}`,
    '',
    `<b>Что предложить:</b>\n${escapeHtml(lead.solution)}`,
    '',
    `<b>Сообщение для отправки:</b>\n${escapeHtml(lead.message)}`,
  ].join('\n');
}

function leadKeyboard(id) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Одобрить', callback_data: `approve:${id}` },
        { text: '❌ Отклонить', callback_data: `reject:${id}` },
        { text: '✏️ Изменить', callback_data: `edit:${id}` },
      ],
    ],
  };
}

/**
 * Отправляет карточку лида с кнопками решения. Возвращает message_id
 * (пригодится, если захотите потом редактировать это же сообщение).
 */
async function sendLeadCard(lead) {
  const result = await callTelegram('sendMessage', {
    chat_id: getChatId(),
    text: formatLeadCard(lead),
    parse_mode: 'HTML',
    reply_markup: leadKeyboard(lead.id),
  });
  return result.result && result.result.message_id;
}

async function sendPlainMessage(text) {
  await callTelegram('sendMessage', {
    chat_id: getChatId(),
    text,
    parse_mode: 'HTML',
  });
}

async function answerCallbackQuery(callbackQueryId, text) {
  await callTelegram('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
    show_alert: false,
  });
}

/**
 * Убирает кнопки и дописывает статус в уже отправленное сообщение —
 * чтобы карточка не оставалась висеть с активными кнопками после решения.
 */
async function markCardDecided(chatId, messageId, statusLabel) {
  try {
    await callTelegram('editMessageReplyMarkup', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    });
  } catch {
    // необязательное действие — если не получилось, не критично
  }
  try {
    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: `Статус обновлён: ${statusLabel}`,
      reply_to_message_id: messageId,
    });
  } catch {
    // тоже необязательно
  }
}

module.exports = {
  formatLeadCard,
  leadKeyboard,
  sendLeadCard,
  sendPlainMessage,
  answerCallbackQuery,
  markCardDecided,
};
