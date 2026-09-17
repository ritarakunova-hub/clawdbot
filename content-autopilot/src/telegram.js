/**
 * Работа с Telegram Bot API: черновик с кнопками в личный чат,
 * публикация в канал, обработка нажатий. Тот же бот, что уже
 * настроен для мини-CRM / Sales Engine — используется встроенный
 * fetch (Node 18+), отдельная библиотека не нужна.
 */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildCallbackData(action, postId) {
  return `${action}:${postId}`;
}

function parseCallbackData(data) {
  const [action, postId] = String(data || '').split(':');
  return { action, postId };
}

/**
 * Черновик, который приходит в личный чат перед публикацией —
 * с кнопками "Опубликовать сейчас" / "Отменить" и предупреждением
 * про автопубликацию по таймеру.
 */
function formatDraftPreview(post, minutesLeft) {
  const lines = [
    `📤 <b>Черновик на сегодня (${escapeHtml(post.rubric)})</b>`,
    `<b>${escapeHtml(post.title)}</b>`,
    '',
    escapeHtml(post.text),
    '',
    `⏱ Если ничего не сделать — опубликую в VK и Telegram-канал через ${minutesLeft} минут само.`,
  ];
  return lines.join('\n');
}

function formatTopicReminder(post) {
  const lines = [
    `📝 <b>Сегодня публикация (${escapeHtml(post.rubric)})</b>`,
    `Тема: <b>${escapeHtml(post.title)}</b>`,
    '',
    'Текст ещё не написан — автопубликации не будет. Соберите по формуле: сцена → закономерность → тихое приглашение, или попросите помочь с текстом здесь, в чате с Claude.',
  ];
  return lines.join('\n');
}

function draftKeyboard(postId) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Опубликовать сейчас', callback_data: buildCallbackData('publish', postId) },
        { text: '❌ Отменить', callback_data: buildCallbackData('cancel', postId) },
      ],
    ],
  };
}

async function apiCall(method, payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Не задана переменная окружения TELEGRAM_BOT_TOKEN');

  const url = `https://api.telegram.org/bot${token}/${method}`;
  const res = await fetch(url, {
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

/**
 * Личный чат — обычный текст, без кнопок (уведомления/итоги).
 */
async function sendPlainMessage(text) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error('Не задана переменная окружения TELEGRAM_CHAT_ID');
  return apiCall('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML' });
}

/**
 * Присылает черновик с кнопками в личный чат, возвращает message_id —
 * он нужен, чтобы потом отредактировать это же сообщение (показать решение).
 */
async function sendDraftPreview(post, minutesLeft) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error('Не задана переменная окружения TELEGRAM_CHAT_ID');
  const result = await apiCall('sendMessage', {
    chat_id: chatId,
    text: formatDraftPreview(post, minutesLeft),
    parse_mode: 'HTML',
    reply_markup: draftKeyboard(post.date),
  });
  return result.result.message_id;
}

async function sendTopicReminder(post) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error('Не задана переменная окружения TELEGRAM_CHAT_ID');
  return apiCall('sendMessage', { chat_id: chatId, text: formatTopicReminder(post), parse_mode: 'HTML' });
}

/**
 * Публикация в канал TAINA — отдельный чат от личных уведомлений.
 */
async function sendChannelPost(text) {
  const channelId = process.env.TELEGRAM_CHANNEL_ID;
  if (!channelId) throw new Error('Не задана переменная окружения TELEGRAM_CHANNEL_ID');
  return apiCall('sendMessage', { chat_id: channelId, text, parse_mode: 'HTML' });
}

/**
 * Убирает кнопки с уже решённого черновика и дописывает статус в текст —
 * чтобы не оставалось активных кнопок на устаревшем сообщении.
 */
async function markDraftDecided(chatId, messageId, statusLine) {
  await apiCall('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } });
  return apiCall('sendMessage', { chat_id: chatId, text: statusLine, parse_mode: 'HTML' });
}

async function answerCallbackQuery(callbackQueryId, text) {
  return apiCall('answerCallbackQuery', { callback_query_id: callbackQueryId, text, show_alert: false });
}

module.exports = {
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
