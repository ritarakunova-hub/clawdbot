/**
 * Telegram Bot API: черновик на согласование, явное подтверждение,
 * публикация в канал и ручная проверка после возможного частичного сбоя.
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildCallbackData(action, postId) {
  return action + ':' + postId;
}

function parseCallbackData(data) {
  const parts = String(data || '').split(':');
  return { action: parts[0] || '', postId: parts[1] };
}

function formatDraftPreview(post) {
  return [
    '📝 <b>Черновик на согласование (' + escapeHtml(post.rubric) + ')</b>',
    '<b>' + escapeHtml(post.title) + '</b>',
    '',
    escapeHtml(post.text),
    '',
    'Публикация произойдёт только после нажатия кнопки. Если ничего не делать — пост останется черновиком.'
  ].join('\n');
}

function formatTopicReminder(post) {
  return [
    '📝 <b>Тема на сегодня (' + escapeHtml(post.rubric) + ')</b>',
    'Тема: <b>' + escapeHtml(post.title) + '</b>',
    '',
    'Текст ещё не написан. Автопубликации нет: подготовьте текст отдельно или попросите помочь с черновиком в чате.'
  ].join('\n');
}

function draftKeyboard(postId) {
  return {
    inline_keyboard: [[
      { text: '✅ Опубликовать в VK и Telegram', callback_data: buildCallbackData('publish', postId) },
      { text: '❌ Отклонить', callback_data: buildCallbackData('cancel', postId) }
    ]]
  };
}

function reviewKeyboard(postId) {
  return {
    inline_keyboard: [[
      { text: '✅ Я проверила каналы — закрыть черновик', callback_data: buildCallbackData('reviewed', postId) }
    ]]
  };
}

async function apiCall(method, payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Не задана переменная окружения TELEGRAM_BOT_TOKEN');

  const url = 'https://api.telegram.org/bot' + token + '/' + method;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  let body;
  try {
    body = await res.json();
  } catch {
    throw new Error('Telegram API (' + method + ') вернул невалидный JSON, HTTP ' + res.status);
  }
  if (!res.ok || body.ok !== true) {
    const description = body && body.description ? body.description : 'неизвестная ошибка API';
    throw new Error('Telegram API (' + method + ') вернул ' + res.status + ': ' + description);
  }
  return body;
}

async function sendPlainMessage(text) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error('Не задана переменная окружения TELEGRAM_CHAT_ID');
  return apiCall('sendMessage', { chat_id: chatId, text: text, parse_mode: 'HTML' });
}

async function sendDraftPreview(post) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error('Не задана переменная окружения TELEGRAM_CHAT_ID');
  const result = await apiCall('sendMessage', {
    chat_id: chatId,
    text: formatDraftPreview(post),
    parse_mode: 'HTML',
    reply_markup: draftKeyboard(post.date)
  });
  return result.result.message_id;
}

async function sendTopicReminder(post) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error('Не задана переменная окружения TELEGRAM_CHAT_ID');
  return apiCall('sendMessage', { chat_id: chatId, text: formatTopicReminder(post), parse_mode: 'HTML' });
}

async function sendChannelPost(text) {
  const channelId = process.env.TELEGRAM_CHANNEL_ID;
  if (!channelId) throw new Error('Не задана переменная окружения TELEGRAM_CHANNEL_ID');
  // Posts are plain text from the calendar; do not parse user-authored text as HTML.
  return apiCall('sendMessage', { chat_id: channelId, text: text });
}

async function markDraftDecided(chatId, messageId, statusLine) {
  await apiCall('editMessageReplyMarkup', {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] }
  });
  return apiCall('sendMessage', { chat_id: chatId, text: statusLine, parse_mode: 'HTML' });
}

async function markDraftNeedsReview(chatId, messageId, statusText, postId) {
  return apiCall('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: statusText,
    parse_mode: 'HTML',
    reply_markup: reviewKeyboard(postId)
  });
}

async function answerCallbackQuery(callbackQueryId, text) {
  return apiCall('answerCallbackQuery', { callback_query_id: callbackQueryId, text: text, show_alert: false });
}

module.exports = {
  formatDraftPreview,
  formatTopicReminder,
  buildCallbackData,
  parseCallbackData,
  draftKeyboard,
  reviewKeyboard,
  sendPlainMessage,
  sendDraftPreview,
  sendTopicReminder,
  sendChannelPost,
  markDraftDecided,
  markDraftNeedsReview,
  answerCallbackQuery,
  apiCall
};
