const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'posts.json');

function isValidDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ''))) return false;
  const date = new Date(dateStr + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === dateStr;
}

function validatePosts(posts) {
  if (!Array.isArray(posts)) throw new Error('Календарь должен содержать массив posts');
  const seen = new Set();

  for (const post of posts) {
    if (!post || !isValidDate(post.date)) throw new Error('В календаре найдена некорректная дата');
    if (seen.has(post.date)) throw new Error('В календаре повторяется дата ' + post.date);
    seen.add(post.date);
    if (!['full', 'topic'].includes(post.type)) throw new Error('Неизвестный тип публикации на ' + post.date);
    if (!String(post.title || '').trim() || !String(post.rubric || '').trim()) {
      throw new Error('У публикации ' + post.date + ' нет заголовка или рубрики');
    }
    if (post.type === 'full' && !String(post.text || '').trim()) {
      throw new Error('У готовой публикации ' + post.date + ' отсутствует текст');
    }
  }

  return posts;
}

function loadPosts() {
  const raw = fs.readFileSync(DATA_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  return validatePosts(parsed.posts);
}

function getPostForDate(dateStr, posts = loadPosts()) {
  return posts.find((post) => post.date === dateStr) || null;
}

function todayInTimezone(timeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

module.exports = { loadPosts, getPostForDate, todayInTimezone, validatePosts, isValidDate };
