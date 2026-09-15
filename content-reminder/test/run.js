// Простые проверки без обращения к реальному Telegram — запускаются: npm test
const assert = require('node:assert');
const { getPostForDate, loadPosts, todayInTimezone } = require('../src/posts');
const { formatFullReminder, formatTopicReminder } = require('../src/telegram');

// 1. Календарь реально загружается и в нём 46 записей (12 полных + 34 темы)
{
  const posts = loadPosts();
  assert.strictEqual(posts.length, 46);
  const full = posts.filter((p) => p.type === 'full');
  const topic = posts.filter((p) => p.type === 'topic');
  assert.strictEqual(full.length, 12);
  assert.strictEqual(topic.length, 34);
  console.log('OK: календарь загружен, 12 полных + 34 темы');
}

// 2. getPostForDate находит запись на дату старта (17.09.2026)
{
  const post = getPostForDate('2026-09-17');
  assert.ok(post);
  assert.strictEqual(post.type, 'full');
  assert.strictEqual(post.rubric, 'Путь');
  assert.ok(post.text.includes('Маргарита, TAINA STUDIO'));
  console.log('OK: getPostForDate находит пост на дату старта');
}

// 3. getPostForDate возвращает null на дату без публикации (пятница, не входит в вт/чт/сб)
{
  const post = getPostForDate('2026-09-18');
  assert.strictEqual(post, null);
  console.log('OK: getPostForDate — null на день без публикации');
}

// 4. getPostForDate находит "лёгкую" тему без готового текста (после 13.10)
{
  const post = getPostForDate('2026-10-15');
  assert.ok(post);
  assert.strictEqual(post.type, 'topic');
  assert.ok(!post.text);
  console.log('OK: getPostForDate находит тему без полного текста');
}

// 5. formatFullReminder — экранирует HTML и включает текст поста целиком
{
  const text = formatFullReminder({
    rubric: 'Путь',
    title: 'Тест <script>',
    text: 'A & B',
  });
  assert.ok(text.includes('&lt;script&gt;'));
  assert.ok(!text.includes('<script>'));
  assert.ok(text.includes('A &amp; B'));
  console.log('OK: formatFullReminder экранирует HTML');
}

// 6. formatTopicReminder — не падает без текста, напоминает про формулу
{
  const text = formatTopicReminder({ rubric: 'Система', title: 'Тема без текста' });
  assert.ok(text.includes('Тема без текста'));
  assert.ok(text.includes('формуле'));
  console.log('OK: formatTopicReminder работает без готового текста');
}

// 7. todayInTimezone возвращает дату в формате YYYY-MM-DD
{
  const today = todayInTimezone('Europe/Moscow');
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(today));
  console.log('OK: todayInTimezone — корректный формат даты');
}

console.log('\nВсе проверки пройдены.');
