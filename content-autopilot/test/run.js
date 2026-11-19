const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.PENDING_FILE = path.join(os.tmpdir(), 'taina-pending-test-' + process.pid + '.json');

const { getPostForDate, loadPosts, todayInTimezone, validatePosts } = require('../src/posts');
const {
  formatDraftPreview,
  formatTopicReminder,
  buildCallbackData,
  parseCallbackData,
} = require('../src/telegram');
const { buildWallPostParams, postToWall } = require('../src/vk');
const { publish, formatPublishSummary } = require('../src/publisher');
const { loadPending, savePending, clearPending } = require('../src/pending');
const { isTimedAutoPublishEnabled, isInternalRequestAuthorized, isTelegramWebhookAuthorized, isTelegramOwnerCallback } = require('../src/config');
const { getPendingDecision } = require('../src/schedule');
const { getReadiness } = require('../src/preflight');

async function main() {
  // 1. Safety defaults and authentication guards.
  {
    assert.equal(isTimedAutoPublishEnabled({}), false);
    assert.equal(isTimedAutoPublishEnabled({ AUTO_PUBLISH_ENABLED: 'false' }), false);
    assert.equal(isTimedAutoPublishEnabled({ AUTO_PUBLISH_ENABLED: 'true' }), true);
    assert.equal(isInternalRequestAuthorized('Bearer secret', ''), false);
    assert.equal(isInternalRequestAuthorized('Bearer wrong', 'secret'), false);
    assert.equal(isInternalRequestAuthorized('Bearer secret', 'secret'), true);
    assert.equal(isTelegramWebhookAuthorized('secret', ''), false);
    assert.equal(isTelegramWebhookAuthorized('wrong', 'secret'), false);
    assert.equal(isTelegramWebhookAuthorized('secret', 'secret'), true);
    assert.equal(isTelegramOwnerCallback({ message: { chat: { id: 123 } }, from: { id: 123 } }, '123'), true);
    assert.equal(isTelegramOwnerCallback({ message: { chat: { id: 123 } }, from: { id: 456 } }, '123'), false);
    assert.equal(isTelegramOwnerCallback({ message: { chat: { id: -100 } }, from: { id: 123 } }, '123'), false);
    assert.equal(isTelegramOwnerCallback({ from: { id: 123 } }, '123'), false);
    console.log('OK: timed publishing is off by default and callbacks are restricted to the owner');
  }

  // 2. Readiness checks required settings without ever returning secret values.
  {
    const env = {
      TELEGRAM_BOT_TOKEN: 'fake-token-for-tests',
      TELEGRAM_CHAT_ID: '123456789',
      TELEGRAM_CHANNEL_ID: '-100123456789',
      TELEGRAM_WEBHOOK_SECRET: 'fake-webhook-secret',
      VK_GROUP_ID: '12345',
      VK_COMMUNITY_TOKEN: 'fake-vk-token',
      INTERNAL_API_SECRET: 'fake-internal-secret',
      PENDING_FILE: path.join(os.tmpdir(), 'taina-ready-test-' + process.pid, 'pending.json'),
    };
    const ready = getReadiness(env);
    assert.equal(ready.ready, true);
    assert.equal(ready.storageWritable, true);
    assert.deepEqual(ready.missing, []);
    assert.ok(!JSON.stringify(ready).includes('fake-token-for-tests'));
    assert.ok(!JSON.stringify(ready).includes('fake-vk-token'));

    const invalid = getReadiness({ ...env, VK_GROUP_ID: 'not-a-number', PENDING_FILE: '' });
    assert.equal(invalid.ready, false);
    assert.ok(invalid.missing.includes('PENDING_FILE'));
    assert.ok(invalid.invalid.includes('VK_GROUP_ID'));
    console.log('OK: readiness validates deployment settings and writable storage without exposing secrets');
  }

  // 3. Calendar structure and date uniqueness.
  {
    const posts = loadPosts();
    assert.ok(posts.length >= 1);
    assert.equal(new Set(posts.map((post) => post.date)).size, posts.length);
    assert.ok(posts.every((post) => /^\d{4}-\d{2}-\d{2}$/.test(post.date)));
    assert.ok(posts.every((post) => ['full', 'topic'].includes(post.type)));
    assert.ok(posts.filter((post) => post.type === 'full').every((post) => post.text.trim()));
    console.log('OK: calendar is valid; dates are unique and full posts have text');
  }

  // 3. Forward campaign reflects the current TAINA offer, not the retired offer.
  {
    const campaign = loadPosts().filter((post) => post.date >= '2026-11-19');
    assert.equal(campaign.length, 12);
    assert.ok(campaign.every((post) => post.type === 'full' && post.text.trim()));
    const forbidden = /(архетип|rag-ассистент|форма на сайте|70 000 ₽|1 490 ₽)/i;
    const weeklyCounts = new Map();
    const weekdays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    for (const post of campaign) {
      assert.ok(!forbidden.test(post.title + ' ' + post.text), 'Retired offer in post ' + post.date);
      const date = new Date(post.date + 'T00:00:00.000Z');
      assert.equal(post.weekday, weekdays[date.getUTCDay()], 'Wrong weekday for ' + post.date);
      date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
      const week = date.toISOString().slice(0, 10);
      weeklyCounts.set(week, (weeklyCounts.get(week) || 0) + 1);
    }
    assert.ok([...weeklyCounts.values()].every((count) => count <= 2), 'Calendar must not exceed two posts per week');
    console.log('OK: 12 ready-to-review posts match the offer and respect the two-post weekly cap');
  }

  // 4. A completed post cannot be recreated by a repeated manual check on the same day.
  {
    assert.equal(getPendingDecision(null, '2026-11-20'), 'create');
    assert.equal(getPendingDecision({ postId: '2026-11-20', status: 'pending' }, '2026-11-20'), 'keep_pending');
    assert.equal(getPendingDecision({ postId: '2026-11-20', status: 'published' }, '2026-11-20'), 'already_processed');
    assert.equal(getPendingDecision({ postId: '2026-11-20', status: 'cancelled' }, '2026-11-20'), 'already_processed');
    assert.equal(getPendingDecision({ postId: '2026-11-19', status: 'pending' }, '2026-11-20'), 'keep_pending');
    assert.equal(getPendingDecision({ postId: '2026-11-19', status: 'published' }, '2026-11-20'), 'clear_and_create');
    assert.equal(getPendingDecision({ postId: '2026-11-21', status: 'published' }, '2026-11-20'), 'keep_pending');
    console.log('OK: same-day duplicate posts are blocked and unfinished drafts are preserved');
  }

  // 5. Lookup by date and a day with no post.
  {
    const post = getPostForDate('2026-11-20');
    assert.ok(post && post.type === 'full');
    assert.equal(getPostForDate('2026-11-22'), null);
    console.log('OK: date lookup returns the right post and skips empty days');
  }

  // 6. Duplicate and impossible dates are rejected.
  {
    assert.throws(() => validatePosts([
      { date: '2026-11-20', type: 'topic', title: 'A', rubric: 'B' },
      { date: '2026-11-20', type: 'topic', title: 'C', rubric: 'D' },
    ]), /повторяется дата/);
    assert.throws(() => validatePosts([
      { date: '2026-02-30', type: 'topic', title: 'A', rubric: 'B' },
    ]), /некорректная дата/);
    console.log('OK: invalid and duplicate calendar dates are blocked');
  }

  // 7. Default draft is manual; timed publishing requires an explicit option.
  {
    const post = { date: '2026-11-20', rubric: 'Практика', title: 'Тест <b>', text: 'A & B' };
    const draft = formatDraftPreview(post);
    assert.ok(draft.includes('&lt;b&gt;'));
    assert.ok(draft.includes('A &amp; B'));
    assert.ok(draft.includes('не будет опубликовано'));
    assert.ok(!draft.includes('через 30 минут'));
    const timed = formatDraftPreview(post, { autoPublishEnabled: true, minutesLeft: 30 });
    assert.ok(timed.includes('через 30 минут'));
    console.log('OK: publishing requires a button press unless timed mode is explicitly enabled');
  }

  // 8. A topic without copy is never published.
  {
    const reminder = formatTopicReminder({ rubric: 'Практика', title: 'Тема без текста' });
    assert.ok(reminder.includes('Тема без текста'));
    assert.ok(reminder.includes('Публикации не будет'));
    console.log('OK: topic-only entries do not publish');
  }

  // 9. Callback data accepts only supported actions and real dates.
  {
    const data = buildCallbackData('publish', '2026-11-20');
    assert.equal(data, 'publish:2026-11-20');
    assert.deepEqual(parseCallbackData(data), { action: 'publish', postId: '2026-11-20' });
    assert.deepEqual(parseCallbackData('delete:2026-11-20'), { action: '', postId: undefined });
    assert.deepEqual(parseCallbackData('publish:2026-02-30'), { action: '', postId: undefined });
    assert.throws(() => buildCallbackData('other', '2026-11-20'));
    console.log('OK: Telegram callback payloads are validated');
  }

  // 10. VK group ID is normalized and invalid IDs are rejected.
  {
    const params = buildWallPostParams({ groupId: '12345', message: 'привет', accessToken: 'fake-test-token' });
    assert.equal(params.owner_id, '-12345');
    assert.equal(params.from_group, '1');
    assert.equal(params.message, 'привет');
    assert.throws(() => buildWallPostParams({ groupId: 'abc', message: 'x', accessToken: 'test' }), /целым/);
    console.log('OK: VK wall.post parameters are validated');
  }

  // 11. VK credentials are sent in the POST body, never in the request URL.
  {
    const originalFetch = global.fetch;
    const originalGroupId = process.env.VK_GROUP_ID;
    const originalToken = process.env.VK_COMMUNITY_TOKEN;
    let capturedRequest;
    try {
      process.env.VK_GROUP_ID = '54321';
      process.env.VK_COMMUNITY_TOKEN = 'test-token-not-a-real-secret';
      global.fetch = async (url, options) => {
        capturedRequest = { url, options };
        return { ok: true, json: async () => ({ response: { post_id: 77 } }) };
      };
      const response = await postToWall('Проверочный текст');
      assert.equal(response.post_id, 77);
      assert.equal(capturedRequest.url, 'https://api.vk.com/method/wall.post');
      assert.equal(capturedRequest.options.method, 'POST');
      assert.ok(capturedRequest.options.body.includes('access_token=test-token-not-a-real-secret'));
      assert.ok(!capturedRequest.url.includes('test-token-not-a-real-secret'));
      console.log('OK: VK access token stays in the POST body and success response is verified');
    } finally {
      global.fetch = originalFetch;
      if (originalGroupId === undefined) delete process.env.VK_GROUP_ID;
      else process.env.VK_GROUP_ID = originalGroupId;
      if (originalToken === undefined) delete process.env.VK_COMMUNITY_TOKEN;
      else process.env.VK_COMMUNITY_TOKEN = originalToken;
    }
  }

  // 12. Partial failure: retry skips the already-confirmed destination.
  {
    let telegramCalls = 0;
    let vkCalls = 0;
    const first = await publish('тест', {
      sendToTelegram: async () => { telegramCalls += 1; },
      sendToVk: async () => { vkCalls += 1; throw new Error('временная ошибка'); },
    });
    assert.equal(first.telegram, 'ok');
    assert.match(first.vk, /временная ошибка/);

    const second = await publish('тест', {
      alreadyPublished: { telegram: true },
      sendToTelegram: async () => { telegramCalls += 1; },
      sendToVk: async () => { vkCalls += 1; },
    });
    assert.equal(second.telegram, 'ok');
    assert.equal(second.vk, 'ok');
    assert.equal(telegramCalls, 1);
    assert.equal(vkCalls, 2);
    console.log('OK: retry sends only to the destination without confirmation');
  }

  // 13. Partial publication is reported as partial, not as complete success.
  {
    const partial = formatPublishSummary({ telegram: 'ok', vk: 'ошибка: 403' }, { remaining: true });
    assert.ok(partial.includes('Telegram-канал: ✅'));
    assert.ok(partial.includes('VK: ⚠️'));
    assert.ok(partial.includes('Черновик сохранён'));
    console.log('OK: partial publication stays visible and retryable');
  }

  // 14. Pending state is written atomically, read back and removed.
  {
    clearPending();
    const pending = {
      postId: '2026-11-20',
      text: 'Тестовый черновик',
      published: { telegram: true, vk: false },
    };
    savePending(pending);
    assert.deepEqual(loadPending(), pending);
    clearPending();
    assert.equal(loadPending(), null);
    console.log('OK: pending state is persisted and cleared');
  }

  // 15. Timezone helper returns an ISO date.
  {
    assert.match(todayInTimezone('Europe/Moscow'), /^\d{4}-\d{2}-\d{2}$/);
    console.log('OK: timezone helper returns YYYY-MM-DD');
  }

  clearPending();
  console.log('\nAll Content Autopilot checks passed.');
}

main().catch((err) => {
  try { clearPending(); } catch {}
  console.error(err);
  process.exitCode = 1;
});
