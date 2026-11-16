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
  reviewKeyboard,
  apiCall
} = require('../src/telegram');
const { buildWallPostParams } = require('../src/vk');
const { formatPublishSummary, publish } = require('../src/publisher');
const { loadPending, savePending, clearPending } = require('../src/pending');
const { safeSecretEquals, isAuthorizedCallback } = require('../src/security');
const { postToWall } = require('../src/vk');

{
  const posts = loadPosts();
  assert.strictEqual(posts.length, 32);
  assert.strictEqual(posts.filter((post) => post.type === 'full').length, 18);
  assert.strictEqual(posts.filter((post) => post.type === 'topic').length, 14);
  const upcoming = posts.filter((post) => post.date >= '2026-11-15');
  assert.deepStrictEqual(upcoming.map((post) => post.date), [
    '2026-11-17', '2026-11-19', '2026-11-22',
    '2026-11-24', '2026-11-26', '2026-11-29'
  ]);
  assert.ok(upcoming.every((post) => post.type === 'full' && post.telegramText));
  assert.ok(!upcoming.some((post) => /RAG|архетип|ассистент/i.test(post.title)));
  console.log('OK: calendar data');
}

{
  const post = getPostForDate('2026-09-17');
  assert.ok(post && post.type === 'full');
  assert.strictEqual(getPostForDate('2026-09-18'), null);
  console.log('OK: date lookup');
}

{
  const message = formatDraftPreview({ rubric: 'Путь', title: 'Test <b>', text: 'A & B', telegramText: 'C & D' });
  assert.ok(message.includes('&lt;b&gt;'));
  assert.ok(!message.includes('Test <b>'));
  assert.ok(message.includes('A &amp; B'));
  assert.ok(message.includes('VK — основная версия'));
  assert.ok(message.includes('Telegram — короткая версия'));
  assert.ok(message.includes('C &amp; D'));
  assert.ok(message.includes('только после нажатия кнопки'));
  assert.ok(!/через \d+ минут|если ничего не делать.{0,40}опубликую/i.test(message));
  console.log('OK: explicit approval preview');
}

{
  const message = formatTopicReminder({ rubric: 'Система', title: 'Topic without text' });
  assert.ok(message.includes('Topic without text'));
  assert.ok(message.includes('Автопубликации нет'));
  console.log('OK: topic reminder');
}

{
  const data = buildCallbackData('publish', '2026-09-17');
  assert.strictEqual(data, 'publish:2026-09-17');
  const parsed = parseCallbackData(data);
  assert.strictEqual(parsed.action, 'publish');
  assert.strictEqual(parsed.postId, '2026-09-17');
  assert.strictEqual(parseCallbackData('').action, '');
  console.log('OK: callback data');
}

{
  const draftButtons = draftKeyboard('2026-09-17').inline_keyboard[0];
  assert.strictEqual(draftButtons[0].callback_data, 'publish:2026-09-17');
  assert.ok(draftButtons[0].text.includes('Опубликовать'));
  assert.strictEqual(draftButtons[1].callback_data, 'cancel:2026-09-17');
  const reviewButton = reviewKeyboard('2026-09-17').inline_keyboard[0][0];
  assert.strictEqual(reviewButton.callback_data, 'reviewed:2026-09-17');
  console.log('OK: approval controls');
}

{
  const positive = buildWallPostParams({ groupId: '12345', message: 'hello', accessToken: 'token' });
  const negative = buildWallPostParams({ groupId: '-12345', message: 'hello', accessToken: 'token' });
  assert.strictEqual(positive.owner_id, '-12345');
  assert.strictEqual(negative.owner_id, '-12345');
  assert.strictEqual(positive.from_group, '1');
  assert.throws(() => buildWallPostParams({ groupId: '9007199254740992', message: 'hello', accessToken: 'token' }), /безопасным целым числом/);
  assert.throws(() => buildWallPostParams({ groupId: '12.5', message: 'hello', accessToken: 'token' }), /целым положительным ID/);
  assert.throws(() => buildWallPostParams({ groupId: '0', message: 'hello', accessToken: 'token' }), /безопасным целым числом/);
  console.log('OK: VK parameters and safe community ID validation');
}

{
  const complete = formatPublishSummary({ telegram: 'ok', vk: 'ok' });
  assert.ok(complete.includes('завершена на обеих площадках'));
  const partial = formatPublishSummary({ telegram: 'ok', vk: 'ошибка: 403' });
  assert.ok(partial.includes('не полностью'));
  assert.ok(/не повторяйте/i.test(partial));
  console.log('OK: publish summary');
}

{
  const value = { postId: '2026-09-17', status: 'awaiting_approval' };
  savePending(value);
  assert.strictEqual(fs.statSync(testDataDir).mode & 0o777, 0o700);
  assert.deepStrictEqual(loadPending(), value);
  clearPending();
  assert.strictEqual(loadPending(), null);
  fs.writeFileSync(path.join(testDataDir, 'pending.json'), '{broken-json');
  assert.throws(() => loadPending(), SyntaxError);
  fs.unlinkSync(path.join(testDataDir, 'pending.json'));
  console.log('OK: pending storage fails closed on corrupt JSON');
}

{
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  assert.ok(!/\bsetTimeout\s*\(/.test(source));
  assert.ok(!/APPROVAL_WINDOW_MINUTES|auto:\s*true/.test(source));
  assert.ok(source.includes('if (!TELEGRAM_WEBHOOK_SECRET)'));
  assert.ok(source.includes('TELEGRAM_APPROVER_ID'));
  assert.ok(source.includes('isAuthorizedCallback'));
  assert.ok(source.includes("limit: '64kb'"));
  assert.ok(source.includes('ADMIN_WEBHOOK_SECRET'));
  assert.ok(source.includes('x-taina-admin-secret'));
  console.log('OK: no auto-publish path and protected manual trigger');
}

{
  const today = todayInTimezone('Europe/Moscow');
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(today));
  console.log('OK: timezone date');
}

{
  assert.strictEqual(safeSecretEquals('same-secret', 'same-secret'), true);
  assert.strictEqual(safeSecretEquals('wrong-secret', 'same-secret'), false);
  assert.strictEqual(safeSecretEquals('x', 'same-secret'), false);
  assert.strictEqual(safeSecretEquals('', ''), false);

  const pendingIdentity = { telegramChatId: '123456', telegramMessageId: 42 };
  const approvalCallback = {
    from: { id: 987654 },
    message: { message_id: 42, chat: { id: 123456 } }
  };
  assert.strictEqual(isAuthorizedCallback(approvalCallback, pendingIdentity, '987654'), true);
  assert.strictEqual(isAuthorizedCallback({ ...approvalCallback, from: { id: 111111 } }, pendingIdentity, '987654'), false);
  assert.strictEqual(isAuthorizedCallback({ ...approvalCallback, message: { ...approvalCallback.message, message_id: 41 } }, pendingIdentity, '987654'), false);
  assert.strictEqual(isAuthorizedCallback({ ...approvalCallback, message: { ...approvalCallback.message, chat: { id: 999999 } } }, pendingIdentity, '987654'), false);
  assert.strictEqual(isAuthorizedCallback(approvalCallback, pendingIdentity, ''), false);
  assert.strictEqual(isAuthorizedCallback(approvalCallback, { ...pendingIdentity, telegramMessageId: null }, '987654'), false);
  console.log('OK: constant-time secret comparison');
}

// 13. VK must not treat HTTP errors or malformed success payloads as a published post.
async function testVkApiResponses() {
  const telegramModule = require('../src/telegram');
  const originalFetch = global.fetch;
  const originalGroup = process.env.VK_GROUP_ID;
  const originalToken = process.env.VK_COMMUNITY_TOKEN;
  process.env.VK_GROUP_ID = '12345';
  process.env.VK_COMMUNITY_TOKEN = 'secret-test-token';

  try {
    let capturedUrl = '';
    let capturedBody = '';
    global.fetch = async (url, options) => {
      capturedUrl = String(url);
      capturedBody = String(options.body);
      return { ok: true, status: 200, json: async () => ({ response: { post_id: 77 } }) };
    };
    const success = await postToWall('Hello');
    assert.strictEqual(success.post_id, 77);
    assert.strictEqual(capturedUrl, 'https://api.vk.com/method/wall.post');
    assert.ok(capturedBody.includes('access_token=secret-test-token'));

    global.fetch = async () => ({
      ok: true, status: 200, json: async () => ({ response: {} })
    });
    await assert.rejects(() => postToWall('Hello'), /не вернул подтверждение/);

    global.fetch = async () => ({
      ok: false, status: 502, json: async () => ({})
    });
    await assert.rejects(() => postToWall('Hello'), /HTTP 502/);
    console.log('OK: VK API errors and response validation');
  } finally {
    global.fetch = originalFetch;
    if (originalGroup === undefined) delete process.env.VK_GROUP_ID;
    else process.env.VK_GROUP_ID = originalGroup;
    if (originalToken === undefined) delete process.env.VK_COMMUNITY_TOKEN;
    else process.env.VK_COMMUNITY_TOKEN = originalToken;
  }
}

// 12. Telegram API body-level errors must not be mistaken for success.
async function testTelegramApiBodyErrors() {
  const originalFetch = global.fetch;
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN = 'test-token';

  try {
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: false, description: 'Forbidden & invalid <chat>' })
    });
    await assert.rejects(
      () => apiCall('sendMessage', { chat_id: '1', text: 'test' }),
      /Forbidden & invalid <chat>/
    );

    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: { message_id: 42 } })
    });
    const success = await apiCall('sendMessage', { chat_id: '1', text: 'test' });
    assert.strictEqual(success.result.message_id, 42);
    console.log('OK: Telegram API body-level errors');
  } finally {
    global.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = originalToken;
  }
}

async function testPlatformSpecificContent() {
  const telegram = require('../src/telegram');
  const vk = require('../src/vk');
  const originalTelegram = telegram.sendChannelPost;
  const originalVk = vk.postToWall;
  let sentToTelegram = '';
  let sentToVk = '';

  telegram.sendChannelPost = async (text) => { sentToTelegram = text; };
  vk.postToWall = async (text) => { sentToVk = text; };
  try {
    const result = await publish({ text: 'Long VK version', telegramText: 'Short Telegram version' });
    assert.deepStrictEqual(result, { telegram: 'ok', vk: 'ok' });
    assert.strictEqual(sentToTelegram, 'Short Telegram version');
    assert.strictEqual(sentToVk, 'Long VK version');
    console.log('OK: platform-specific post text');
  } finally {
    telegram.sendChannelPost = originalTelegram;
    vk.postToWall = originalVk;
  }
}


async function testWebhookSetup() {
  const { setTelegramWebhook } = require('../src/webhook-setup');
  const botToken = '123456:TEST_BOT_TOKEN';
  const secretToken = 'webhook-secret-for-tests-0123456789';
  const webhookUrl = 'https://automation.example.com/telegram/webhook';
  let capturedUrl = '';
  let capturedOptions;

  const result = await setTelegramWebhook({
    botToken,
    secretToken,
    webhookUrl,
    fetchImpl: async (url, options) => {
      capturedUrl = String(url);
      capturedOptions = options;
      return { ok: true, status: 200, json: async () => ({ ok: true, result: true }) };
    }
  });

  assert.strictEqual(capturedUrl, 'https://api.telegram.org/bot' + botToken + '/setWebhook');
  assert.strictEqual(capturedOptions.method, 'POST');
  assert.strictEqual(capturedOptions.headers['Content-Type'], 'application/x-www-form-urlencoded');
  const payload = new URLSearchParams(capturedOptions.body);
  assert.strictEqual(payload.get('url'), webhookUrl);
  assert.strictEqual(payload.get('secret_token'), secretToken);
  assert.ok(!capturedUrl.includes(secretToken));
  assert.deepStrictEqual(result, { ok: true, webhookUrl });

  await assert.rejects(() => setTelegramWebhook({
    botToken, secretToken, webhookUrl: 'http://automation.example.com/telegram/webhook',
    fetchImpl: async () => { throw new Error('fetch should not run'); }
  }), /HTTPS/);

  await assert.rejects(() => setTelegramWebhook({
    botToken, secretToken: 'short', webhookUrl,
    fetchImpl: async () => { throw new Error('fetch should not run'); }
  }), /32–256/);

  await assert.rejects(() => setTelegramWebhook({
    botToken, secretToken, webhookUrl,
    fetchImpl: async () => ({
      ok: true, status: 200, json: async () => ({ ok: false, description: 'Unauthorized' })
    })
  }), /Unauthorized/);

  await assert.rejects(() => setTelegramWebhook({
    botToken, secretToken, webhookUrl,
    fetchImpl: async () => ({
      ok: false, status: 502, json: async () => ({ ok: true })
    })
  }), /HTTP 502/);

  console.log('OK: secure Telegram webhook setup and API failures');
}


async function testPreflight() {
  const { runPreflight, validateCalendar } = require('../scripts/preflight');
  const webhookSecret = 'telegram-webhook-secret-for-tests-012345';
  const adminSecret = 'different-admin-secret-for-tests-0123456';
  const env = {
    TELEGRAM_BOT_TOKEN: '123456:TEST_BOT_TOKEN',
    TELEGRAM_CHAT_ID: '123456',
    TELEGRAM_CHANNEL_ID: '-100123456',
    TELEGRAM_APPROVER_ID: '987654',
    TELEGRAM_WEBHOOK_SECRET: webhookSecret,
    TELEGRAM_WEBHOOK_URL: 'https://automation.example.com/telegram/webhook',
    ADMIN_WEBHOOK_SECRET: adminSecret,
    VK_GROUP_ID: '654321',
    VK_COMMUNITY_TOKEN: 'vk-test-token',
    TIMEZONE: 'Europe/Moscow'
  };
  const dataDir = path.join(testDataDir, 'preflight-data');
  const passed = runPreflight(env, dataDir);
  assert.strictEqual(passed.ok, true, passed.errors.join('; '));
  assert.ok(passed.calendarCount > 0);
  assert.strictEqual(fs.existsSync(dataDir), true);

  const invalid = runPreflight({
    ...env,
    TELEGRAM_WEBHOOK_URL: 'http://automation.example.com/telegram/webhook',
    ADMIN_WEBHOOK_SECRET: webhookSecret,
    VK_GROUP_ID: 'not-a-number',
    TELEGRAM_APPROVER_ID: 'not-numeric',
    TIMEZONE: 'Not/A_Timezone'
  }, path.join(testDataDir, 'invalid-preflight-data'));
  assert.strictEqual(invalid.ok, false);
  assert.ok(invalid.errors.some((error) => /HTTPS/.test(error)));
  assert.ok(invalid.errors.some((error) => /должны различаться/.test(error)));
  assert.ok(invalid.errors.some((error) => /VK_GROUP_ID/.test(error)));
  assert.ok(invalid.errors.some((error) => /TELEGRAM_APPROVER_ID/.test(error)));
  assert.ok(invalid.errors.some((error) => /часовой пояс/.test(error)));

  const posts = loadPosts();
  const duplicateCalendar = validateCalendar(posts.concat([{ ...posts[0] }]));
  assert.ok(duplicateCalendar.some((error) => /дата дублируется/.test(error)));
  console.log('OK: deployment preflight and calendar validation');
}

testTelegramApiBodyErrors().then(testPlatformSpecificContent).then(testVkApiResponses).then(testWebhookSetup).then(testPreflight).then(() => {
  fs.rmSync(testDataDir, { recursive: true, force: true });
  console.log('\\nAll checks passed.');
}).catch((err) => {
  console.error(err);
  fs.rmSync(testDataDir, { recursive: true, force: true });
  process.exitCode = 1;
});
