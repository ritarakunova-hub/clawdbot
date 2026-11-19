const express = require('express');
const cron = require('node-cron');
const { timingSafeEqual } = require('node:crypto');
const { getPostForDate, todayInTimezone } = require('./src/posts');
const telegram = require('./src/telegram');
const { publish, formatPublishSummary } = require('./src/publisher');
const { loadPending, savePending, clearPending } = require('./src/pending');

const app = express();
app.use(express.json({ limit: '64kb' }));

const PORT = process.env.PORT || 3000;
const TIMEZONE = process.env.TIMEZONE || 'Europe/Moscow';
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 9 * * *';
const APPROVAL_WINDOW_MINUTES = Number(process.env.APPROVAL_WINDOW_MINUTES || 30);
// Safe by default: no post is published without an explicit button press.
const AUTO_PUBLISH_ENABLED = process.env.AUTO_PUBLISH_ENABLED === 'true';
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || '';

if (!Number.isFinite(APPROVAL_WINDOW_MINUTES) || APPROVAL_WINDOW_MINUTES < 1) {
  throw new Error('APPROVAL_WINDOW_MINUTES must be a positive number');
}

const timers = new Map();
const resolving = new Set();
let checkInProgress = false;

function safeEqual(actual, expected) {
  const left = Buffer.from(String(actual || ''));
  const right = Buffer.from(String(expected || ''));
  return left.length === right.length && timingSafeEqual(left, right);
}

function stopTimer(postId) {
  const timer = timers.get(postId);
  if (timer) clearTimeout(timer);
  timers.delete(postId);
}

async function resolvePublish(pending, { auto = false } = {}) {
  if (resolving.has(pending.postId)) throw new Error('This draft is already being processed');
  resolving.add(pending.postId);

  try {
    const current = loadPending();
    if (!current || current.postId !== pending.postId) {
      throw new Error('Draft is stale or has already been processed');
    }

    stopTimer(current.postId);
    const results = await publish(current.text, {
      alreadyPublished: current.published || {},
    });

    const published = {
      telegram: Boolean(current.published && current.published.telegram) || results.telegram === 'ok',
      vk: Boolean(current.published && current.published.vk) || results.vk === 'ok',
    };

    if (published.telegram && published.vk) {
      clearPending();
      const summary = formatPublishSummary(results, { auto });
      if (current.telegramMessageId && current.telegramChatId) {
        try {
          await telegram.markDraftDecided(current.telegramChatId, current.telegramMessageId, summary);
        } catch (err) {
          console.error('[content-autopilot] Published, but could not update the Telegram draft:', err.message);
          await telegram.sendPlainMessage(summary);
        }
      } else {
        await telegram.sendPlainMessage(summary);
      }
      return { status: 'published', results };
    }

    // Keep successful destinations in state: retry only the destination
    // that has not confirmed publication.
    savePending({
      ...current,
      published,
      lastAttemptAt: new Date().toISOString(),
    });
    const summary = formatPublishSummary(results, { auto, remaining: true });
    await telegram.sendPlainMessage(summary);
    return { status: 'partial', results };
  } finally {
    resolving.delete(pending.postId);
  }
}

async function resolveCancel(pending) {
  if (resolving.has(pending.postId)) throw new Error('This draft is already being processed');
  resolving.add(pending.postId);

  try {
    const current = loadPending();
    if (!current || current.postId !== pending.postId) {
      throw new Error('Draft is stale or has already been processed');
    }

    stopTimer(current.postId);
    clearPending();
    const alreadyPublished = current.published || {};
    const text = alreadyPublished.telegram || alreadyPublished.vk
      ? 'Remaining publication cancelled. Already published destinations were not changed.'
      : 'Cancelled — nothing will be published to VK or Telegram.';
    if (current.telegramMessageId && current.telegramChatId) {
      await telegram.markDraftDecided(current.telegramChatId, current.telegramMessageId, text);
    } else {
      await telegram.sendPlainMessage(text);
    }
  } finally {
    resolving.delete(pending.postId);
  }
}

function scheduleTimeout(pending) {
  if (!AUTO_PUBLISH_ENABLED || !pending.scheduledPublishAt) return;
  stopTimer(pending.postId);
  const msLeft = new Date(pending.scheduledPublishAt).getTime() - Date.now();
  const timer = setTimeout(() => {
    resolvePublish(pending, { auto: true }).catch((err) => {
      console.error('[content-autopilot] Timer publication error:', err.message);
    });
  }, Math.max(0, msLeft));
  timers.set(pending.postId, timer);
}

async function checkAndSchedule() {
  if (checkInProgress) return { status: 'already_running' };
  checkInProgress = true;

  try {
    const existing = loadPending();
    if (existing) {
      console.log('[content-autopilot] Draft ' + existing.postId + ' is already waiting for a decision');
      return { status: 'pending_exists', postId: existing.postId };
    }

    const today = todayInTimezone(TIMEZONE);
    const post = getPostForDate(today);
    if (!post) {
      console.log('[content-autopilot] No post scheduled for ' + today);
      return { status: 'no_post' };
    }

    if (post.type === 'topic') {
      await telegram.sendTopicReminder(post);
      return { status: 'topic_reminder' };
    }

    const pending = {
      postId: post.date,
      title: post.title,
      rubric: post.rubric,
      text: post.text,
      telegramMessageId: null,
      telegramChatId: process.env.TELEGRAM_CHAT_ID || null,
      published: { telegram: false, vk: false },
      createdAt: new Date().toISOString(),
      scheduledPublishAt: AUTO_PUBLISH_ENABLED
        ? new Date(Date.now() + APPROVAL_WINDOW_MINUTES * 60000).toISOString()
        : null,
    };

    savePending(pending);
    try {
      const messageId = await telegram.sendDraftPreview(post, {
        autoPublishEnabled: AUTO_PUBLISH_ENABLED,
        minutesLeft: APPROVAL_WINDOW_MINUTES,
      });
      pending.telegramMessageId = messageId;
      savePending(pending);
      if (AUTO_PUBLISH_ENABLED) scheduleTimeout(pending);
      console.log('[content-autopilot] Draft ' + post.date + ' sent for manual approval');
      return { status: 'draft_sent', postId: post.date };
    } catch (err) {
      clearPending();
      throw err;
    }
  } finally {
    checkInProgress = false;
  }
}

app.get('/health', (req, res) => res.status(200).json({
  ok: true,
  approvalRequired: !AUTO_PUBLISH_ENABLED,
}));

// Protected manual trigger.
app.post('/check/now', async (req, res) => {
  if (!INTERNAL_API_SECRET) {
    return res.status(503).json({ ok: false, error: 'INTERNAL_API_SECRET is not configured' });
  }
  if (!safeEqual(req.headers.authorization, 'Bearer ' + INTERNAL_API_SECRET)) {
    return res.status(401).json({ ok: false });
  }

  try {
    const result = await checkAndSchedule();
    res.status(200).json({ ok: true, result });
  } catch (err) {
    console.error('[content-autopilot] Manual trigger failed:', err.message);
    res.status(500).json({ ok: false, error: 'Could not prepare draft' });
  }
});

// Accept only Telegram webhooks with the configured secret and buttons
// belonging to the owner's private chat.
app.post('/telegram/webhook', (req, res) => {
  if (!TELEGRAM_WEBHOOK_SECRET) {
    return res.status(503).json({ ok: false, error: 'TELEGRAM_WEBHOOK_SECRET is not configured' });
  }
  if (!safeEqual(req.headers['x-telegram-bot-api-secret-token'], TELEGRAM_WEBHOOK_SECRET)) {
    return res.status(401).json({ ok: false });
  }

  const callback = req.body && req.body.callback_query;
  res.status(200).json({ ok: true });
  if (!callback) return;

  const parsed = telegram.parseCallbackData(callback.data);
  const callbackChatId = callback.message && callback.message.chat && callback.message.chat.id;
  if (!parsed.action || String(callbackChatId) !== String(process.env.TELEGRAM_CHAT_ID || '')) {
    telegram.answerCallbackQuery(callback.id, 'Access denied or invalid button').catch(() => {});
    return;
  }

  const pending = loadPending();
  if (!pending || pending.postId !== parsed.postId) {
    telegram.answerCallbackQuery(callback.id, 'This draft is stale or already processed').catch(() => {});
    return;
  }

  if (resolving.has(pending.postId)) {
    telegram.answerCallbackQuery(callback.id, 'This action is already being processed').catch(() => {});
    return;
  }

  const action = parsed.action === 'publish'
    ? resolvePublish(pending, { auto: false })
    : resolveCancel(pending);

  action
    .then(() => telegram.answerCallbackQuery(callback.id, parsed.action === 'publish' ? 'Publication check finished' : 'Cancelled'))
    .catch(async (err) => {
      console.error('[content-autopilot] Telegram decision failed:', err.message);
      try {
        await telegram.answerCallbackQuery(callback.id, 'Could not complete the action. The draft was kept for review.');
      } catch {
        // The Telegram callback may have expired; the pending state is more important.
      }
    });
});

cron.schedule(
  CRON_SCHEDULE,
  () => {
    checkAndSchedule().catch((err) => {
      console.error('[content-autopilot] Scheduled check failed:', err.message);
    });
  },
  { timezone: TIMEZONE }
);

(function resumePendingOnStartup() {
  const pending = loadPending();
  if (!pending) return;

  if (!AUTO_PUBLISH_ENABLED) {
    console.log('[content-autopilot] Draft ' + pending.postId + ' is waiting for manual approval');
    return;
  }

  if (pending.scheduledPublishAt) {
    console.log('[content-autopilot] Restoring explicitly enabled timer for ' + pending.postId);
    scheduleTimeout(pending);
  }
})();

app.listen(PORT, () => {
  console.log('TAINA Content Autopilot listening on port ' + PORT);
  console.log('Schedule: "' + CRON_SCHEDULE + '" (' + TIMEZONE + '); timed auto-publish: ' + (AUTO_PUBLISH_ENABLED ? 'ENABLED' : 'DISABLED'));
});
