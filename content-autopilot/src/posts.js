const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'posts.json');

/**
 * Календарь постов TAINA — читаем из JSON, а не из кода, чтобы можно
 * было обновлять темы/тексты без деплоя (просто отредактировать файл).
 */
function loadPosts() {
  const raw = fs.readFileSync(DATA_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.posts) ? parsed.posts : [];
}

/**
 * Возвращает запись календаря на указанную дату (формат YYYY-MM-DD)
 * или null, если на эту дату публикация не запланирована.
 */
function getPostForDate(dateStr, posts = loadPosts()) {
  return posts.find((p) => p.date === dateStr) || null;
}

/**
 * Сегодняшняя дата в формате YYYY-MM-DD с учётом часового пояса —
 * чтобы "сегодня" считалось по МСК, а не по времени сервера.
 */
function todayInTimezone(timeZone) {
  // en-CA даёт готовый формат YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

module.exports = { loadPosts, getPostForDate, todayInTimezone };
