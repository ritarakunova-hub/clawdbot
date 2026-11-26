/**
 * Telegram Bot API: owner review and handoff of approved copy to SMMplanner.
 * This service never publishes directly to VK or Telegram channels.
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
  if (!['approve', 'cancel'].includes(action) || !isIsoDate(postId)) {
    throw new Error('Invalid Telegram callback data');
  }
  return action + ':' + postId;
}

function parseCallbackData(data) {
  const match = /^(approve|cancel):(\d{4}-\d{2}-\d{2})$/.exec(String(data || ''));
  if (!match || !isIsoDate(match[2])) return { action: '', postId: undefined };
  return { action: match[1], postId: match[2] };
}

function formatDraftPreview(post) {
  const lines = [
    '📝 <b>Черновик TAINA на ' + escapeHtml(post.date) + '</b>',
    '<b>' + escapeHtml(post.title) + '</b>',
    'Рубрика: ' + escapeHtml(post.rubric),
    '',
    escapeHtml(post.text),
    '',
    'После согласования пришлю отдельное сообщение с готовым текстом для размещения в SMMplanner. Самостоятельной публикации бот не делает.',
  ];
  return lines.join('\n');
}

function formatTopicReminder(post) {
  return [
    '📝 <b>Тема для публикации (' + escapeHtml(post.rubric) + ')</b>',
    'Тема: <b>' + escapeHtml(post.title) + '</b>',
    '',
    'Готового текста в календаре нет. В SMMplanner ничего не отправлено. Можно попросить подготовить черновик и проверить его перед размещением.',
  ].join('\n');
}

function draftKeyboard(postId) {
  return {
    inline_keyboard: [[
      { text: '✅ Согласовать для SMMplanner', callback_data: buildCallbackData('approve', postId) },
      { text: '❌ Отменить', callback_data: buildCallbackData('cancel', postId) },
    ]],
  };
}

const TELEGRAM_API_TIMEOUT_MS = 15000;

async function apiCall(method, payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured');

  const url = 'https://api.telegram.org/bot' + token + '/' + method;
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TELEGRAM_API_TIMEOUT_MS),
    });
  } catch (err) {
    // Do not include the request URL or raw fetch error: Telegram URLs contain the bot token.
    const timedOut = err && (err.name === 'TimeoutError' || err.name === 'AbortError');
    const reason = timedOut
      ? 'timed out after ' + TELEGRAM_API_TIMEOUT_MS + 'ms'
      : 'request failed (' + (err && err.name ? err.name : 'network error') + ')';
    const safeError = new Error('Telegram API (' + method + ') ' + reason + '; external outcome may be unknown');
    safeError.code = timedOut ? 'TELEGRAM_TIMEOUT' : 'TELEGRAM_REQUEST_FAILED';
    throw safeError;
  }

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

async function sendDraftPreview(post) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error('TELEGRAM_CHAT_ID is not configured');
  const result = await apiCall('sendMessage', {
    chat_id: chatId,
    text: formatDraftPreview(post),
    parse_mode: 'HTML',
    reply_markup: draftKeyboard(post.date),
  });
  return result.result.message_id;
}

async function sendSmmplannerReadyMessage(post) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error('TELEGRAM_CHAT_ID is not configured');

  const text = [
    'TAINA · ТЕКСТ СОГЛАСОВАН',
    'Дата публикации: ' + post.postId,
    'Площадки: Telegram + VK',
    'Добавь этот текст в SMMplanner и выбери обе площадки и время публикации.',
    '',
    post.text,
  ].join('\n');

  return apiCall('sendMessage', {
    chat_id: chatId,
    text,
    reply_markup: {
      inline_keyboard: [[
        { text: 'Открыть SMMplanner', url: 'https://smmplanner.com/' },
      ]],
    },
  });
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

async function removeDraftButtons(chatId, messageId) {
  return apiCall('editMessageReplyMarkup', {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] },
  });
}

async function markDraftDecided(chatId, messageId, statusLine) {
  await removeDraftButtons(chatId, messageId);
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
  sendSmmplannerReadyMessage,
  sendTopicReminder,
  removeDraftButtons,
  markDraftDecided,
  answerCallbackQuery,
  TELEGRAM_API_TIMEOUT_MS,
};
