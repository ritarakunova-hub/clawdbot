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

function getChannelId() {
  const channelId = process.env.TELEGRAM_CHANNEL_ID;
  if (!channelId) throw new Error('Не задана переменная окружения TELEGRAM_CHANNEL_ID');
  return channelId;
}

function formatPostText(post) {
  const hashtags = String(post.hashtags || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => `#${tag.replace(/^#/, '')}`)
    .join(' ');
  return hashtags ? `${post.text}\n\n${hashtags}` : post.text;
}

/**
 * Собирает текст карточки-черновика — то, что видит человек в Telegram
 * перед публикацией. Это НЕ то, что публикуется в канал — там только
 * сам текст поста (см. formatPostText).
 */
function formatDraftCard(post) {
  return [
    `📝 <b>Черновик поста</b> — «${escapeHtml(post.topic)}»`,
    `Куда: ${escapeHtml(post.platforms)}`,
    '',
    escapeHtml(formatPostText(post)),
  ].join('\n');
}

function draftKeyboard(id) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Опубликовать', callback_data: `approve:${id}` },
        { text: '❌ Отклонить', callback_data: `reject:${id}` },
        { text: '✏️ Изменить', callback_data: `edit:${id}` },
      ],
    ],
  };
}

/**
 * Отправляет карточку-черновик с кнопками решения в личный/админский чат.
 * Возвращает message_id.
 */
async function sendDraftCard(post) {
  const result = await callTelegram('sendMessage', {
    chat_id: getChatId(),
    text: formatDraftCard(post),
    parse_mode: 'HTML',
    reply_markup: draftKeyboard(post.id),
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

/**
 * Публикует готовый текст поста в канал TAINA. Бот должен быть
 * администратором канала с правом публикации сообщений.
 */
async function publishToChannel(text) {
  const result = await callTelegram('sendMessage', {
    chat_id: getChannelId(),
    text,
  });
  return result.result && result.result.message_id;
}

async function answerCallbackQuery(callbackQueryId, text) {
  await callTelegram('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
    show_alert: false,
  });
}

/**
 * Убирает кнопки и дописывает статус в уже отправленную карточку —
 * чтобы она не оставалась висеть с активными кнопками после решения.
 */
async function markCardDecided(chatId, messageId, statusLabel) {
  try {
    await callTelegram('editMessageReplyMarkup', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    });
  } catch {
    // необязательное действие
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
  formatPostText,
  formatDraftCard,
  draftKeyboard,
  sendDraftCard,
  sendPlainMessage,
  publishToChannel,
  answerCallbackQuery,
  markCardDecided,
};
