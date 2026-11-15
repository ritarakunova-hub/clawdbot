// Проверки без обращения к реальным Telegram/VK — npm test
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taina-content-autopilot-'));
process.env.CONTENT_AUTOPILOT_DATA_DIR = testDataDir;

const { getPostForDate, loadPosts, todayInTimezone } = require('../src/posts');
const {
  formatDraftPreview,
  formatTopicReminder,
  buildCallbackData,
  parseCallbackData,
  draftKeyboard,
  reviewKeyboard
} = require('../src/telegram');
const { buildWallPostParams } = require('../src/vk');
const { formatPublishSummary } = require('../src/publisher');
const { loadPending, savePending, clearPending } = require('../src/pending');

// 1. Calendar data
{
  const posts = loadPosts();
  assert.strictEqual(posts.length, 46);
  assert.strictEqual(posts.filter((post) => post.type === 'full').length, 12);
  assert.strictEqual(posts.filter((post) => post.type === 'topic').length, 34);
  console.log('OK: calendar data');
}

// 2. Date lookup
{
  const post = getPostForDate('2026-09-17');
  assert.ok(post && post.type === 'full');
  assert.strictEqual(getPostForDate('2026-09-18'), null);
  console.log('OK: date lookup');
}

// 3. Draft preview requires explicit approval and escapes HTML
{
  const message = formatDraftPreview({ rubric: 'Путь', title: 'Test <b>', text: 'A & B' });
  assert.ok(message.includes('&lt;b&gt;'));
  assert.ok(!message.includes('Test <b>'));
  assert.ok(message.includes('A &amp; B'));
  assert.ok(message.includes('только после нажатия кнопки'));
  assert.ok(!/через \d+ минут|если ничего не делать.{0,40}опубликую/i.test(message));
  console.log('OK: explicit approval preview');
}

// 4. Topic reminder does not publish
{
  const message = formatTopicReminder({ rubric: 'Система', title: 'Topic without text' });
  assert.ok(message.includes('Topic without text'));
  assert.ok(message.includes('Автопубликации нет'));
  console.log('OK: topic reminder');
}

// 5. Callback data round trip
{
  const data = buildCallbackData('publish', '2026-09-17');
  assert.strictEqual(data, 'publish:2026-09-17');
  const parsed = parseCallbackData(data);
  assert.strictEqual(parsed.action, 'publish');
  assert.strictEqual(parsed.postId, '2026-09-17');
  assert.strictEqual(parseCallbackData('').action, '');
  console.log('OK: callback data');
}

// 6. Draft and review keyboards
{
  const draftButtons = draftKeyboard('2026-09-17').inline_keyboard[0];
  assert.strictEqual(draftButtons[0].callback_data, 'publish:2026-09-17');
  assert.ok(draftButtons[0].text.includes('Опубликовать'));
  assert.strictEqual(draftButtons[1].callback_data, 'cancel:2026-09-17');
  const reviewButton = reviewKeyboard('2026-09-17').inline_keyboard[0][0];
  assert.strictEqual(reviewButton.callback_data, 'reviewed:2026-09-17');
  console.log('OK: approval controls');
}

// 7. VK group wall parameters
{
  const positive = buildWallPostParams({ groupId: '12345', message: 'hello', accessToken: 'token' });
  const negative = buildWallPostParams({ groupId: '-12345', message: 'hello', accessToken: 'token' });
  assert.strictEqual(positive.owner_id, '-12345');
  assert.strictEqual(negative.owner_id, '-12345');
  assert.strictEqual(positive.from_group, '1');
  console.log('OK: VK parameters');
}

// 8. Publish summary exposes partial failures
{
  const complete = formatPublishSummary({ telegram: 'ok', vk: 'ok' });
  assert.ok(complete.includes('завершена на обеих площадках'));
  const partial = formatPublishSummary({ telegram: 'ok', vk: 'ошибка: 403' });
  assert.ok(partial.includes('не полностью'));
  assert.ok(partial.includes('не повторяйте'));
  console.log('OK: publish summary');
}

// 9. Atomic pending storage
{
  const value = { postId: '2026-09-17', status: 'awaiting_approval' };
  savePending(value);
  assert.deepStrictEqual(loadPending(), value);
  clearPending();
  assert.strictEqual(loadPending(), null);
  console.log('OK: pending storage');
}

// 10. Static guard: no timer-based publication, fail-closed webhook and approver check
{
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  assert.ok(!/\bsetTimeout\s*\(/.test(source));
  assert.ok(!/APPROVAL_WINDOW_MINUTES|scheduledPublishAt|auto:\s*true/.test(source));
  assert.ok(source.includes('if (!TELEGRAM_WEBHOOK_SECRET)'));
  assert.ok(source.includes('TELEGRAM_APPROVER_ID'));
  console.log('OK: no auto-publish path');
}

// 11. Timezone date format
{
  const today = todayInTimezone('Europe/Moscow');
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(today));
  console.log('OK: timezone date');
}

fs.rmSync(testDataDir, { recursive: true, force: true });
console.log('\nAll checks passed.');
