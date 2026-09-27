// Простые проверки без обращения к реальным Telegram/VK/Claude — запускаются: npm test
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
const { getPostForDate, loadPosts, savePosts, setPostText, todayInTimezone } = require('../src/posts');
const {
  formatDraftPreview,
  formatTopicReminder,
  buildCallbackData,
  parseCallbackData,
} = require('../src/telegram');
const { buildWallPostParams } = require('../src/vk');
const { formatPublishSummary } = require('../src/publisher');

// 1. Календарь: 46 записей (12 полных + 34 темы)
{
  const posts = loadPosts();
  assert.strictEqual(posts.length, 46);
  assert.strictEqual(posts.filter((p) => p.type === 'full').length, 12);
  assert.strictEqual(posts.filter((p) => p.type === 'topic').length, 34);
  console.log('OK: календарь загружен, 12 полных + 34 темы');
}

// 2. getPostForDate — дата старта и день без публикации
{
  const post = getPostForDate('2026-09-17');
  assert.ok(post && post.type === 'full');
  assert.strictEqual(getPostForDate('2026-09-18'), null);
  console.log('OK: getPostForDate — дата старта и день без публикации');
}

// 3. formatDraftPreview — экранирует HTML, показывает минуты до автопубликации
{
  const text = formatDraftPreview({ rubric: 'Путь', title: 'Тест <b>', text: 'A & B' }, 30);
  assert.ok(text.includes('&lt;b&gt;'));
  assert.ok(!text.includes('Тест <b>')); // сырой ввод не должен просочиться неэкранированным
  assert.ok(text.includes('A &amp; B'));
  assert.ok(text.includes('30 минут'));
  console.log('OK: formatDraftPreview экранирует HTML и показывает окно');
}

// 4. formatTopicReminder — предупреждает, что автопубликации не будет
{
  const text = formatTopicReminder({ rubric: 'Система', title: 'Тема без текста' });
  assert.ok(text.includes('Тема без текста'));
  assert.ok(text.includes('не будет'));
  console.log('OK: formatTopicReminder предупреждает об отсутствии автопубликации');
}

// 5. callback_data — собирается и разбирается обратно
{
  const data = buildCallbackData('publish', '2026-09-17');
  assert.strictEqual(data, 'publish:2026-09-17');
  const parsed = parseCallbackData(data);
  assert.strictEqual(parsed.action, 'publish');
  assert.strictEqual(parsed.postId, '2026-09-17');
  console.log('OK: buildCallbackData / parseCallbackData');
}

// 6. parseCallbackData — не падает на мусоре
{
  const parsed = parseCallbackData('');
  assert.strictEqual(parsed.action, '');
  assert.strictEqual(parsed.postId, undefined);
  console.log('OK: parseCallbackData не падает на пустой строке');
}

// 7. buildWallPostParams — owner_id всегда отрицательный для паблика,
// независимо от того, передали ли groupId с минусом или без
{
  const params1 = buildWallPostParams({ groupId: '12345', message: 'привет', accessToken: 'tok' });
  assert.strictEqual(params1.owner_id, '-12345');
  const params2 = buildWallPostParams({ groupId: '-12345', message: 'привет', accessToken: 'tok' });
  assert.strictEqual(params2.owner_id, '-12345');
  assert.strictEqual(params1.from_group, '1');
  assert.strictEqual(params1.message, 'привет');
  console.log('OK: buildWallPostParams — owner_id корректный для паблика');
}

// 8. formatPublishSummary — показывает статус по каждой площадке отдельно
{
  const ok = formatPublishSummary({ telegram: 'ok', vk: 'ok' }, { auto: true });
  assert.ok(ok.includes('Автопубликация'));
  assert.ok(ok.includes('✅'));

  const partial = formatPublishSummary({ telegram: 'ok', vk: 'ошибка: 403' }, { auto: false });
  assert.ok(partial.includes('Опубликовано вручную'));
  assert.ok(partial.includes('⚠️ ошибка: 403'));
  console.log('OK: formatPublishSummary показывает частичный сбой');
}

// 9. todayInTimezone — корректный формат
{
  const today = todayInTimezone('Europe/Moscow');
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(today));
  console.log('OK: todayInTimezone — корректный формат даты');
}

// 10. setPostText — дописывает текст и меняет type "topic" → "full",
// работает на временном файле, чтобы не трогать реальный календарь
{
  const tmpPath = path.join(os.tmpdir(), `posts-test-${Date.now()}.json`);
  savePosts(
    [
      { date: '2099-01-01', rubric: 'Путь', title: 'Тема без текста', type: 'topic' },
      { date: '2099-01-03', rubric: 'Система', title: 'Уже с текстом', type: 'full', text: 'старый текст' },
    ],
    tmpPath
  );

  const updated = setPostText('2099-01-01', 'Новый текст поста', tmpPath);
  assert.ok(updated);
  assert.strictEqual(updated.type, 'full');
  assert.strictEqual(updated.text, 'Новый текст поста');

  const reloaded = loadPosts(tmpPath);
  assert.strictEqual(getPostForDate('2099-01-01', reloaded).text, 'Новый текст поста');

  assert.strictEqual(setPostText('2099-06-30', 'текст', tmpPath), null);

  fs.unlinkSync(tmpPath);
  console.log('OK: setPostText — дописывает текст на временном файле, не трогая реальный календарь');
}

// 11. claude.generateText — без реального обращения к API (global.fetch подменяем,
// именно на нём в итоге работает SDK), проверяем, что рубрика/тема/заметки
// попадают в тело запроса и что ответ API корректно разбирается в текст
{
  (async () => {
    const originalFetch = global.fetch;
    let capturedBody = null;

    // Клиент Anthropic SDK захватывает global.fetch в момент создания —
    // подменяем ДО первого require('../src/claude'), иначе мок не подхватится.
    global.fetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      const payload = { content: [{ type: 'text', text: 'Сгенерированный текст поста' }] };
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => payload,
        text: async () => JSON.stringify(payload),
      };
    };
    delete require.cache[require.resolve('../src/claude')];
    const claude = require('../src/claude');

    try {
      const text = await claude.generateText({ rubric: 'Технология', title: 'Тестовая тема', notes: 'важная деталь' });
      assert.strictEqual(text, 'Сгенерированный текст поста');
      assert.ok(capturedBody.messages[0].content.includes('Рубрика: Технология'));
      assert.ok(capturedBody.messages[0].content.includes('Тестовая тема'));
      assert.ok(capturedBody.messages[0].content.includes('важная деталь'));
      console.log('OK: claude.generateText — рубрика/тема/заметки попадают в запрос, ответ разобран верно');
    } finally {
      global.fetch = originalFetch;
    }
  })().then(() => {
    console.log('\nВсе проверки пройдены.');
  }).catch((err) => {
    console.error('ОШИБКА в тестах:', err);
    process.exit(1);
  });
}
