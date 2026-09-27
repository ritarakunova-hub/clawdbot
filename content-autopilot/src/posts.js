const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'posts.json');

/**
 * Календарь постов TAINA — читаем из JSON, а не из кода, чтобы можно
 * было обновлять темы/тексты без деплоя (просто отредактировать файл).
 */
function loadPosts(dataPath = DATA_PATH) {
  const raw = fs.readFileSync(dataPath, 'utf-8');
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

function savePosts(posts, dataPath = DATA_PATH) {
  fs.writeFileSync(dataPath, JSON.stringify({ posts }, null, 2) + '\n');
}

/**
 * Дописывает готовый текст в запись календаря (тема → готовый пост,
 * type становится "full") и сохраняет файл. Возвращает обновлённую
 * запись или null, если на эту дату в календаре ничего не запланировано.
 * dataPath — только для тестов, чтобы не трогать реальный календарь.
 */
function setPostText(dateStr, text, dataPath = DATA_PATH) {
  const posts = loadPosts(dataPath);
  const post = posts.find((p) => p.date === dateStr);
  if (!post) return null;

  post.text = text;
  post.type = 'full';
  savePosts(posts, dataPath);
  return post;
}

/**
 * Сегодняшняя дата в формате YYYY-MM-DD с учётом часового пояса —
 * чтобы "сегодня" считалось по МСК, а не по времени сервера.
 */
function todayInTimezone(timeZone) {
  // en-CA даёт готовый формат YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

module.exports = { loadPosts, getPostForDate, savePosts, setPostText, todayInTimezone };
