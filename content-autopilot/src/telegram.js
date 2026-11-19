/**
 * Telegram Bot API: drafts, reminders and channel publishing.
 * Publication requires an explicit owner action unless timed auto-publish
 * is deliberately enabled with AUTO_PUBLISH_ENABLED=true.
 */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function buildCallbackData(action, postId) {
  if (!['publish', 'cancel'].includes(action) || !isIsoDate(postId)) {
    throw new Error('Invalid Telegram callback data');
  }
  return action + ':' + postId;
}

function parseCallbackData(data) {
  const match = /^(publish|cancel):(\d{4}-\d{2}-\d{2})$/.exec(String(data || ''));
  if (!match || !isIsoDate(match[2])) return { action: '', postId: undefined };
  return { action: match[1], postId: match[2] };
}

function formatDraftPreview(post, { autoPublishEnabled = false, minutesLeft = 30 } = {}) {
  const lines = [
    '📤 <b>Черновик на сегодня (' + escapeHtml(post.rubric) + ')</b>',
    '<b>' + escapeHtml(post.title) + '</b>',
    '',
    escapeHtml(post.text),
    '',
    autoPublishEnabled
      ? '⚠️ Автопубликация включена настройкой. Если не отменить, отправлю через ' + minutesLeft + ' минут.'
      : '🔒 Ничего не будет опубликовано, пока вы явно не нажмёте «Опубликовать сейчас».',
  ];
  return lines.join('\n');
}

function formatTopicReminder(post) {
  return [
    '📝 <b>Тема для публикации (' + escapeHtml(post.rubric) + ')</b>',
    'Тема: <b>' + escapeHtml(post.title) + '</b>',
    '',
    'Готового текста в календаре нет. Публикации не будет. Можно попросить подготовить черновик и проверить его перед отправкой.',
  ].join('\n');
}

function draftKeyboard(postId) {
  return {
    inline_keyboard: [[
      { text: '✅ Опубликовать сейчас', callback_data: buildCallbackData('publish', postId) },
      { text: '❌ Отменить', callback_data: buildCallbackData('cancel', postId) },
    ]],
  };
}

async function apiCall(method, payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured');

  const url = 'https://api.telegram.org/bot' + token + '/' + method;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok || !body || body.ok !== true) {
    const description = body && body.description ? body.description : 'unknown error';
    throw new Error('Telegram API (' + method + ') returned ' + response.status + ': ' + description);
  }
  return body;
}

async function sendPlainMessage(text) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error('TELEGRAM_CHAT_ID is not configured');
  return apiCall('sendMessage', { chat_id: chatId, text });
}

async function sendDraftPreview(post, options = {}) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error('TELEGRAM_CHAT_ID is not configured');
  const result = await apiCall('sendMessage', {
    chat_id: chatId,
    text: formatDraftPreview(post, options),
    parse_mode: 'HTML',
    reply_markup: draftKeyboard(post.date),
  });
  return result.result.message_id;
}

async function sendTopicReminder(post) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error('TELEGRAM_CHAT_ID is not configured');
  return apiCall('sendMessage', {
    chat_id: chatId,
    text: formatTopicReminder(post),
    parse_mode: 'HTML',
  });
}

async function sendChannelPost(text) {
  const channelId = process.env.TELEGRAM_CHANNEL_ID;
  if (!channelId) throw new Error('TELEGRAM_CHANNEL_ID is not configured');
  // Plain text avoids parse errors for characters such as <, > and & in posts.
  return apiCall('sendMessage', { chat_id: channelId, text });
}

async function markDraftDecided(chatId, messageId, statusLine) {
  await apiCall('editMessageReplyMarkup', {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] },
  });
  return apiCall('sendMessage', { chat_id: chatId, text: statusLine });
}

async function answerCallbackQuery(callbackQueryId, text) {
  return apiCall('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
    show_alert: false,
  });
}

module.exports = {
  escapeHtml,
  formatDraftPreview,
  formatTopicReminder,
  buildCallbackData,
  parseCallbackData,
  sendPlainMessage,
  sendDraftPreview,
  sendTopicReminder,
  sendChannelPost,
  markDraftDecided,
  answerCallbackQuery,
};
