const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

process.env.PENDING_FILE = path.join(os.tmpdir(), 'taina-pending-test-' + process.pid + '.json');
process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
process.env.TELEGRAM_CHAT_ID = '123456789';

const { getPostForDate, loadPosts, todayInTimezone, validatePosts } = require('../src/posts');
const {
  formatDraftPreview,
  formatTopicReminder,
  buildCallbackData,
  parseCallbackData,
  sendSmmplannerReadyMessage,
} = require('../src/telegram');
const { loadPending, savePending, clearPending } = require('../src/pending');
const { isInternalRequestAuthorized, isTelegramWebhookAuthorized, isTelegramOwnerCallback } = require('../src/config');
const { getPendingDecision } = require('../src/schedule');
const { getReadiness } = require('../src/preflight');
const { startApprovedAction } = require('../src/callback');

async function main() {
  // 1. Webhook and owner authorization.
  {
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
    console.log('OK: internal endpoint, webhook and owner callbacks are authenticated');
  }

  // 2. Readiness requires only Telegram owner-bot credentials and persistent state.
  {
    const env = {
      TELEGRAM_BOT_TOKEN: 'fake-telegram-token',
      TELEGRAM_CHAT_ID: '123456789',
      TELEGRAM_WEBHOOK_SECRET: 'fake-webhook-secret',
      INTERNAL_API_SECRET: 'fake-internal-secret',
      PENDING_FILE: path.join(os.tmpdir(), 'taina-ready-test-' + process.pid, 'pending.json'),
    };
    const ready = getReadiness(env);
    assert.equal(ready.ready, true);
    assert.equal(ready.storageWritable, true);
    assert.deepEqual(ready.missing, []);
    assert.equal(ready.publisher, 'SMMplanner');
    assert.equal(ready.directPublishing, false);
    assert.ok(!JSON.stringify(ready).includes('fake-telegram-token'));

    const invalid = getReadiness({ ...env, TELEGRAM_BOT_TOKEN: '', PENDING_FILE: '' });
    assert.equal(invalid.ready, false);
    assert.ok(invalid.missing.includes('TELEGRAM_BOT_TOKEN'));
    assert.ok(invalid.missing.includes('PENDING_FILE'));
    console.log('OK: readiness validates only the handoff service configuration and writable storage');
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

  // 4. Forward campaign uses the current TAINA offer and respects cadence.
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
    console.log('OK: 12 ready-to-review posts match the current offer and respect the weekly cap');
  }

  // 5. Approved and cancelled posts are tombstoned; topic reminders are not repeated.
  {
    assert.equal(getPendingDecision(null, '2026-11-20'), 'create');
    assert.equal(getPendingDecision({ postId: '2026-11-20', status: 'pending' }, '2026-11-20'), 'keep_pending');
    assert.equal(getPendingDecision({ postId: '2026-11-20', status: 'approved_for_smmplanner' }, '2026-11-20'), 'already_processed');
    assert.equal(getPendingDecision({ postId: '2026-11-20', status: 'cancelled' }, '2026-11-20'), 'already_processed');
    assert.equal(getPendingDecision({ postId: '2026-11-20', status: 'topic_reminder' }, '2026-11-20'), 'already_processed');
    assert.equal(getPendingDecision({ postId: '2026-11-19', status: 'topic_reminder' }, '2026-11-20'), 'clear_and_create');
    assert.equal(getPendingDecision({ postId: '2026-11-19', status: 'pending' }, '2026-11-20'), 'keep_pending');
    assert.equal(getPendingDecision({ postId: '2026-11-19', status: 'published' }, '2026-11-20'), 'clear_and_create');
    assert.equal(getPendingDecision({ postId: '2026-11-21', status: 'approved_for_smmplanner' }, '2026-11-20'), 'keep_pending');
    console.log('OK: approved handoffs, cancellations and topic reminders are not recreated');
  }

  // 6. Date lookup and invalid calendar entries.
  {
    const post = getPostForDate('2026-11-20');
    assert.ok(post && post.type === 'full');
    assert.equal(getPostForDate('2026-11-22'), null);
    assert.throws(() => validatePosts([
      { date: '2026-11-20', type: 'topic', title: 'A', rubric: 'B' },
      { date: '2026-11-20', type: 'topic', title: 'C', rubric: 'D' },
    ]), /повторяется дата/);
    assert.throws(() => validatePosts([
      { date: '2026-02-30', type: 'topic', title: 'A', rubric: 'B' },
    ]), /некорректная дата/);
    console.log('OK: date lookup and calendar validation work');
  }

  // 7. Approval preview clearly separates review from actual publishing.
  {
    const post = { date: '2026-11-20', rubric: 'Практика', title: 'Тест <b>', text: 'A & B' };
    const preview = formatDraftPreview(post);
    assert.ok(preview.includes('&lt;b&gt;'));
    assert.ok(preview.includes('A &amp; B'));
    assert.ok(preview.includes('SMMplanner'));
    assert.ok(preview.includes('не делает'));
    assert.ok(!preview.includes('Автопубликация'));
    const reminder = formatTopicReminder({ rubric: 'Практика', title: 'Тема без текста' });
    assert.ok(reminder.includes('Тема без текста'));
    assert.ok(reminder.includes('SMMplanner'));
    console.log('OK: previews and topic reminders do not promise direct publishing');
  }

  // 8. Telegram callbacks support approval for SMMplanner and cancellation only.
  {
    const data = buildCallbackData('approve', '2026-11-20');
    assert.equal(data, 'approve:2026-11-20');
    assert.deepEqual(parseCallbackData(data), { action: 'approve', postId: '2026-11-20' });
    assert.deepEqual(parseCallbackData('publish:2026-11-20'), { action: '', postId: undefined });
    assert.deepEqual(parseCallbackData('delete:2026-11-20'), { action: '', postId: undefined });
    assert.deepEqual(parseCallbackData('approve:2026-02-30'), { action: '', postId: undefined });
    assert.throws(() => buildCallbackData('publish', '2026-11-20'));
    assert.throws(() => buildCallbackData('approve', '2026-02-30'));
    console.log('OK: callback payloads allow only approve/cancel with real dates');
  }

  // 9. Approved copy is sent to the owner's private chat with an SMMplanner link.
  {
    const originalFetch = global.fetch;
    let captured;
    try {
      global.fetch = async (url, options) => {
        captured = { url, options };
        return {
          ok: true,
          json: async () => ({ ok: true, result: { message_id: 42 } }),
        };
      };
      const result = await sendSmmplannerReadyMessage({
        postId: '2026-11-20',
        title: 'Пост для проверки',
        text: 'Готовый текст поста',
      });
      assert.equal(result.result.message_id, 42);
      assert.equal(captured.url, 'https://api.telegram.org/bottest-bot-token/sendMessage');
      const payload = JSON.parse(captured.options.body);
      assert.equal(payload.chat_id, '123456789');
      assert.ok(payload.text.includes('Готовый текст поста'));
      assert.ok(payload.text.includes('Telegram + VK'));
      assert.equal(payload.reply_markup.inline_keyboard[0][0].url, 'https://smmplanner.com/');
      assert.ok(!payload.text.includes('VK_COMMUNITY_TOKEN'));
      assert.ok(!payload.text.includes('TELEGRAM_CHANNEL_ID'));
      console.log('OK: approved copy is handed to the owner, not published directly');
    } finally {
      global.fetch = originalFetch;
    }
  }

  // 10. Telegram callback is acknowledged before a slow action starts.
  {
    const events = [];
    let finishAction;
    const actionPromise = new Promise((resolve) => { finishAction = resolve; });

    startApprovedAction('test-callback-id', () => {
      events.push('action');
      return actionPromise;
    }, {
      answerCallbackQuery: () => {
        events.push('acknowledgement');
        return new Promise(() => {});
      },
      onActionError: async () => {},
      logger: { error: () => {} },
    });

    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(events, ['acknowledgement', 'action']);
    finishAction();
    await actionPromise;
    console.log('OK: Telegram button acknowledgement does not block the handoff action');
  }

  // 11. Pending state is written atomically and read back.
  {
    clearPending();
    const pending = {
      postId: '2026-11-20',
      text: 'Тестовый черновик',
      status: 'pending',
    };
    savePending(pending);
    assert.deepEqual(loadPending(), pending);
    clearPending();
    assert.equal(loadPending(), null);
    console.log('OK: pending state is persisted and cleared');
  }

  // 12. Timezone helper returns an ISO date.
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
