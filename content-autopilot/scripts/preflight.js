const fs = require('node:fs');
const path = require('node:path');
const { loadPosts } = require('../src/posts');
const { validateWebhookUrl } = require('../src/webhook-setup');

const SECRET_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;
const REQUIRED_KEYS = [
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'TELEGRAM_CHANNEL_ID',
  'TELEGRAM_WEBHOOK_SECRET',
  'TELEGRAM_WEBHOOK_URL',
  'ADMIN_WEBHOOK_SECRET',
  'VK_GROUP_ID',
  'VK_COMMUNITY_TOKEN'
];

function validateCalendar(posts) {
  const errors = [];
  if (!Array.isArray(posts) || posts.length === 0) {
    return ['Календарь публикаций пуст или имеет неверный формат'];
  }

  const seenDates = new Set();
  for (const [index, post] of posts.entries()) {
    const label = 'Запись календаря #' + (index + 1);
    if (!post || typeof post !== 'object') {
      errors.push(label + ': неверный формат');
      continue;
    }

    if (typeof post.date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(post.date) ||
        Number.isNaN(Date.parse(post.date + 'T00:00:00Z')) ||
        new Date(post.date + 'T00:00:00Z').toISOString().slice(0, 10) !== post.date) {
      errors.push(label + ': дата должна быть корректной в формате YYYY-MM-DD');
    } else if (seenDates.has(post.date)) {
      errors.push(label + ': дата дублируется');
    } else {
      seenDates.add(post.date);
    }

    if (typeof post.title !== 'string' || !post.title.trim()) {
      errors.push(label + ': отсутствует заголовок');
    }
    if (!['full', 'topic'].includes(post.type)) {
      errors.push(label + ': тип должен быть full или topic');
    }
    if (post.type === 'full' && (typeof post.text !== 'string' || !post.text.trim())) {
      errors.push(label + ': у готовой публикации отсутствует основной текст');
    }
    if (post.telegramText !== undefined &&
        (typeof post.telegramText !== 'string' || !post.telegramText.trim())) {
      errors.push(label + ': telegramText должен быть непустой строкой');
    }
  }
  return errors;
}

function runPreflight(env = process.env, dataDir) {
  const errors = [];

  for (const key of REQUIRED_KEYS) {
    if (typeof env[key] !== 'string' || !env[key].trim()) {
      errors.push('Не задана обязательная переменная ' + key);
    }
  }

  if (env.TELEGRAM_WEBHOOK_SECRET && !SECRET_PATTERN.test(env.TELEGRAM_WEBHOOK_SECRET)) {
    errors.push('TELEGRAM_WEBHOOK_SECRET: ожидается 32–256 символов из латинских букв, цифр, "_" и "-"');
  }
  if (env.ADMIN_WEBHOOK_SECRET && !SECRET_PATTERN.test(env.ADMIN_WEBHOOK_SECRET)) {
    errors.push('ADMIN_WEBHOOK_SECRET: ожидается 32–256 символов из латинских букв, цифр, "_" и "-"');
  }
  if (env.ADMIN_WEBHOOK_SECRET &&
      env.TELEGRAM_WEBHOOK_SECRET &&
      env.ADMIN_WEBHOOK_SECRET === env.TELEGRAM_WEBHOOK_SECRET) {
    errors.push('ADMIN_WEBHOOK_SECRET и TELEGRAM_WEBHOOK_SECRET должны различаться');
  }

  if (env.TELEGRAM_WEBHOOK_URL) {
    try {
      validateWebhookUrl(env.TELEGRAM_WEBHOOK_URL);
    } catch (err) {
      errors.push(err.message);
    }
  }

  if (env.VK_GROUP_ID && (!/^\d+$/.test(env.VK_GROUP_ID) || Number(env.VK_GROUP_ID) <= 0)) {
    errors.push('VK_GROUP_ID должен быть положительным числовым ID сообщества без знака минус');
  }

  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: env.TIMEZONE || 'Europe/Moscow' }).format(new Date());
  } catch {
    errors.push('TIMEZONE содержит неизвестный часовой пояс');
  }

  let calendarCount = 0;
  try {
    const posts = loadPosts();
    const calendarErrors = validateCalendar(posts);
    calendarCount = posts.length;
    errors.push(...calendarErrors);
  } catch {
    errors.push('Не удалось прочитать data/posts.json');
  }

  const resolvedDataDir = dataDir || env.CONTENT_AUTOPILOT_DATA_DIR || path.join(__dirname, '..', 'data');
  try {
    fs.mkdirSync(resolvedDataDir, { recursive: true });
    fs.accessSync(resolvedDataDir, fs.constants.W_OK);
  } catch {
    errors.push('Каталог состояния недоступен для записи');
  }

  return {
    ok: errors.length === 0,
    errors,
    calendarCount
  };
}

function main() {
  const result = runPreflight();
  if (!result.ok) {
    console.error('Preflight не пройден. Исправьте пункты ниже:');
    result.errors.forEach((error) => console.error('- ' + error));
    process.exitCode = 1;
    return;
  }

  console.log('Preflight пройден: календарь проверен (' + result.calendarCount +
    ' записей), обязательные настройки присутствуют, каталог состояния доступен для записи.');
  console.log('Значения токенов и секретов не выводились.');
}

if (require.main === module) {
  main();
}

module.exports = { runPreflight, validateCalendar };
