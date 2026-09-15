/**
 * Отправка напоминаний в Telegram через Bot API.
 * Используется встроенный fetch (Node 18+) — отдельная библиотека не нужна.
 * Тот же бот и тот же чат, что уже настроены для мини-CRM / Sales Engine —
 * заводить новый бот не нужно.
 */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Карточка на день, когда пост уже написан целиком —
 * текст сразу готов к копированию в VK/Telegram.
 */
function formatFullReminder(post) {
  const lines = [
    `✍️ <b>Пора публиковать (${escapeHtml(post.rubric)})</b>`,
    `<b>${escapeHtml(post.title)}</b>`,
    '',
    escapeHtml(post.text),
  ];
  return lines.join('\n');
}

/**
 * Карточка на день, когда есть только тема (без готового текста) —
 * напоминает про формулу вместо того, чтобы молчать.
 */
function formatTopicReminder(post) {
  const lines = [
    `📝 <b>Сегодня публикация (${escapeHtml(post.rubric)})</b>`,
    `Тема: <b>${escapeHtml(post.title)}</b>`,
    '',
    'Текст ещё не написан — соберите по формуле: сцена → закономерность → тихое приглашение. Если нужна помощь с текстом — просто напишите об этом здесь, в чате с Claude.',
  ];
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
 * Отправляет напоминание про сегодняшний пост — полный текст,
 * если он уже готов, иначе тему и подсказку по формуле.
 */
async function sendReminder(post) {
  const text = post.type === 'full' ? formatFullReminder(post) : formatTopicReminder(post);
  await sendTelegramMessage(text);
}

module.exports = { sendReminder, formatFullReminder, formatTopicReminder, sendTelegramMessage };
