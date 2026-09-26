// Простые проверки без обращения к реальным Claude/Google/Telegram/VK —
// запускаются: npm test
const assert = require('node:assert');
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
const { formatPostText, formatDraftCard, draftKeyboard } = require('../src/telegram');
const vk = require('../src/vk');

// 1. formatPostText — склеивает текст и хэштеги, экранирует не нужно
// (публикуется как есть, без HTML)
{
  const post = { text: 'Привет, мир!', hashtags: 'ai, автоматизация, taina' };
  const result = formatPostText(post);
  assert.ok(result.startsWith('Привет, мир!'));
  assert.ok(result.includes('#ai #автоматизация #taina'));
  console.log('OK: formatPostText — текст + хэштеги');
}
{
  const post = { text: 'Без хэштегов', hashtags: '' };
  assert.strictEqual(formatPostText(post), 'Без хэштегов');
  console.log('OK: formatPostText — без хэштегов не добавляет пустую строку');
}

// 2. formatDraftCard — карточка содержит тему, платформы и экранирует HTML
{
  const post = {
    id: 'abc123',
    topic: 'Пост про <script>',
    platforms: 'telegram, vk',
    text: 'Текст поста',
    hashtags: 'ai',
  };
  const card = formatDraftCard(post);
  assert.ok(card.includes('Пост про &lt;script&gt;'));
  assert.ok(!card.includes('<script>'));
  assert.ok(card.includes('telegram, vk'));
  assert.ok(card.includes('#ai'));
  console.log('OK: formatDraftCard');
}

// 3. draftKeyboard — три кнопки с правильным callback_data
{
  const keyboard = draftKeyboard('abc123');
  const buttons = keyboard.inline_keyboard[0];
  assert.strictEqual(buttons.length, 3);
  assert.strictEqual(buttons[0].callback_data, 'approve:abc123');
  assert.strictEqual(buttons[1].callback_data, 'reject:abc123');
  assert.strictEqual(buttons[2].callback_data, 'edit:abc123');
  console.log('OK: draftKeyboard');
}

// 4. vk.isConfigured / publishToWall — без токенов просто пропускает
{
  delete process.env.VK_ACCESS_TOKEN;
  delete process.env.VK_GROUP_ID;
  assert.strictEqual(vk.isConfigured(), false);
  vk.publishToWall('текст').then((result) => {
    assert.deepStrictEqual(result, { skipped: true });
    console.log('OK: vk.publishToWall — без токена пропускает публикацию');
    console.log('\nВсе проверки пройдены.');
  }).catch((err) => {
    console.error('ОШИБКА в тестах:', err);
    process.exit(1);
  });
}
