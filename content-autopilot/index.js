const express = require('express');
const cron = require('node-cron');
const { getPostForDate, todayInTimezone } = require('./src/posts');
const telegram = require('./src/telegram');
const { loadPending, savePending, clearPending } = require('./src/pending');
const { isInternalRequestAuthorized, isTelegramWebhookAuthorized, isTelegramOwnerCallback } = require('./src/config');
const { getPendingDecision } = require('./src/schedule');
const { getReadiness } = require('./src/preflight');
const { startApprovedAction } = require('./src/callback');
const {
  beginHandoff,
  completeHandoff,
  completeDraftDelivery,
  beginTopicReminder,
  completeTopicReminder,
  markNeedsReview,
  recoverInterruptedOperation,
} = require('./src/operation-state');

const app = express();
app.use(express.json({ limit: '64kb' }));

const PORT = process.env.PORT || 3000;
const TIMEZONE = process.env.TIMEZONE || 'Europe/Moscow';
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 9 * * *';
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || '';
const TELEGRAM_APPROVER_ID = process.env.TELEGRAM_APPROVER_ID || '';

const resolving = new Set();
let checkInProgress = false;

async function resolveApprove(pending) {
  if (resolving.has(pending.postId)) throw new Error('This draft is already being processed');
  resolving.add(pending.postId);

  try {
    const current = loadPending();
    if (!current || current.postId !== pending.postId || current.status !== 'pending') {
      throw new Error('Draft is stale or has already been processed');
    }

    // Persist intent before the Telegram side effect. A restart during dispatch
    // must become manual review, never an automatic second send.
    const dispatching = beginHandoff(current, new Date().toISOString());
    savePending(dispatching);

    try {
      // SMMplanner owns scheduling and publication. We only deliver approved,
      // copy-ready text to the owner's private Telegram chat.
      const handoffMessage = await telegram.sendSmmplannerReadyMessage(dispatching);
      const handoffMessageId = handoffMessage && handoffMessage.result && handoffMessage.result.message_id;
      if (!Number.isSafeInteger(handoffMessageId) || handoffMessageId <= 0) {
        throw new Error('Telegram returned no valid handoff message ID');
      }

      savePending(completeHandoff(dispatching, handoffMessageId, new Date().toISOString()));
    } catch (err) {
      const latest = loadPending();
      if (latest && latest.postId === current.postId && latest.status === 'handoff_dispatching') {
        savePending(markNeedsReview(latest, {
          stage: 'smmplanner_handoff',
          code: err && err.code === 'TELEGRAM_TIMEOUT' ? 'TELEGRAM_TIMEOUT' : 'HANDOFF_OUTCOME_UNKNOWN',
          at: new Date().toISOString(),
        }));
      }
      // Avoid raw error text here: a transport error may contain the bot API URL.
      throw new Error('Передача текста в Telegram имеет неоднозначный результат. Проверьте личный чат вручную; автоматического повтора не будет.');
    }

    if (current.telegramMessageId && current.telegramChatId) {
      try {
        await telegram.removeDraftButtons(current.telegramChatId, current.telegramMessageId);
      } catch (err) {
        console.error('[content-autopilot] Text is ready, but draft buttons could not be removed:', err.message);
      }
    }

    return { status: 'approved_for_smmplanner', postId: current.postId };
  } finally {
    resolving.delete(pending.postId);
  }
}

async function resolveCancel(pending) {
  if (resolving.has(pending.postId)) throw new Error('This draft is already being processed');
  resolving.add(pending.postId);

  try {
    const current = loadPending();
    if (!current || current.postId !== pending.postId || current.status !== 'pending') {
      throw new Error('Draft is stale or has already been processed');
    }

    savePending({
      ...current,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
    });

    if (current.telegramMessageId && current.telegramChatId) {
      await telegram.markDraftDecided(
        current.telegramChatId,
        current.telegramMessageId,
        'Отменено. Текст не передан в SMMplanner.'
      );
    } else {
      await telegram.sendPlainMessage('Отменено. Текст не передан в SMMplanner.');
    }
    return { status: 'cancelled', postId: current.postId };
  } finally {
    resolving.delete(pending.postId);
  }
}

async function checkAndSchedule() {
  if (checkInProgress) return { status: 'already_running' };
  checkInProgress = true;

  try {
    const today = todayInTimezone(TIMEZONE);
    const existing = loadPending();
    const pendingDecision = getPendingDecision(existing, today);

    if (pendingDecision === 'already_processed') {
      console.log('[content-autopilot] Post for ' + today + ' was already ' + existing.status);
      return { status: 'already_processed', postId: existing.postId };
    }
    if (pendingDecision === 'keep_pending') {
      console.log('[content-autopilot] Draft ' + existing.postId + ' is still awaiting a decision');
      return { status: 'pending_exists', postId: existing.postId };
    }
    if (pendingDecision === 'clear_and_create') clearPending();

    const post = getPostForDate(today);
    if (!post) {
      console.log('[content-autopilot] No post scheduled for ' + today);
      return { status: 'no_post' };
    }

    if (post.type === 'topic') {
      const reminder = {
        postId: post.date,
        title: post.title,
        rubric: post.rubric,
        text: '',
        status: 'topic_reminder_pending',
        createdAt: new Date().toISOString(),
      };
      const dispatching = beginTopicReminder(reminder, new Date().toISOString());
      savePending(dispatching);

      try {
        const response = await telegram.sendTopicReminder(post);
        const messageId = response && response.result && response.result.message_id;
        const completed = completeTopicReminder(
          dispatching,
          messageId,
          new Date().toISOString()
        );
        savePending(completed);
        return { status: 'topic_reminder', postId: post.date };
      } catch (err) {
        const latest = loadPending();
        if (latest && latest.postId === post.date && latest.status === 'topic_reminder_dispatching') {
          savePending(markNeedsReview(latest, {
            stage: 'topic_reminder',
            code: err && err.code === 'TELEGRAM_TIMEOUT' ? 'TELEGRAM_TIMEOUT' : 'REMINDER_OUTCOME_UNKNOWN',
            at: new Date().toISOString(),
          }));
        }
        await telegram.sendPlainMessage(
          '⚠️ TAINA: отправка напоминания по теме ' + post.date +
          ' не подтверждена. Проверьте личный чат вручную; повторная отправка заблокирована.'
        ).catch(() => {
          console.error('[content-autopilot] Could not send the topic reminder review notice.');
        });
        throw new Error('Отправка напоминания не подтверждена; требуется ручная проверка.');
      }
    }

    const pending = {
      postId: post.date,
      title: post.title,
      rubric: post.rubric,
      text: post.text,
      telegramMessageId: null,
      telegramChatId: process.env.TELEGRAM_CHAT_ID || null,
      status: 'creating_draft',
      createdAt: new Date().toISOString(),
    };

    savePending(pending);
    try {
      const messageId = await telegram.sendDraftPreview(post);
      if (!Number.isSafeInteger(messageId) || messageId <= 0) {
        throw new Error('Telegram returned no valid draft message ID');
      }
      const awaitingApproval = completeDraftDelivery(pending, messageId);
      savePending(awaitingApproval);
      console.log('[content-autopilot] Draft ' + post.date + ' sent for owner approval');
      return { status: 'draft_sent', postId: post.date };
    } catch (err) {
      const latest = loadPending();
      if (latest && latest.postId === post.date && latest.status === 'creating_draft') {
        savePending(markNeedsReview(latest, {
          stage: 'draft_delivery',
          code: err && err.code === 'TELEGRAM_TIMEOUT' ? 'TELEGRAM_TIMEOUT' : 'DRAFT_OUTCOME_UNKNOWN',
          at: new Date().toISOString(),
        }));
      }
      await telegram.sendPlainMessage(
        '⚠️ TAINA: отправка черновика ' + post.date +
        ' не подтверждена. Проверьте личный чат вручную; автоматическая повторная отправка заблокирована.'
      ).catch(() => {
        console.error('[content-autopilot] Could not send the manual-review notice; inspect pending state on the persistent volume.');
      });
      throw new Error('Отправка черновика в Telegram не подтверждена. Проверьте личный чат вручную; повторная отправка заблокирована.');
    }
  } finally {
    checkInProgress = false;
  }
}

app.get('/health', (req, res) => res.status(200).json({
  ok: true,
  workflow: 'smmplanner-handoff',
  directPublishing: false,
}));

// Readiness is separate from liveness and never returns secret values.
app.get('/ready', (req, res) => {
  const readiness = getReadiness(process.env);
  res.status(readiness.ready ? 200 : 503).json(readiness);
});

// Protected manual trigger.
app.post('/check/now', async (req, res) => {
  if (!INTERNAL_API_SECRET) {
    return res.status(503).json({ ok: false, error: 'INTERNAL_API_SECRET is not configured' });
  }
  if (!isInternalRequestAuthorized(req.headers.authorization, INTERNAL_API_SECRET)) {
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
  if (!isTelegramWebhookAuthorized(req.headers['x-telegram-bot-api-secret-token'], TELEGRAM_WEBHOOK_SECRET)) {
    return res.status(401).json({ ok: false });
  }

  const callback = req.body && req.body.callback_query;
  res.status(200).json({ ok: true });
  if (!callback) return;

  const parsed = telegram.parseCallbackData(callback.data);
  const pending = loadPending();
  if (!parsed.action || !pending || pending.postId !== parsed.postId || pending.status !== 'pending' ||
      !isTelegramOwnerCallback(
        callback,
        process.env.TELEGRAM_CHAT_ID,
        TELEGRAM_APPROVER_ID,
        pending.telegramMessageId
      )) {
    telegram.answerCallbackQuery(callback.id, 'Access denied, stale draft or invalid button').catch(() => {});
    return;
  }

  if (resolving.has(pending.postId)) {
    telegram.answerCallbackQuery(callback.id, 'This action is already being processed').catch(() => {});
    return;
  }

  startApprovedAction(
    callback.id,
    () => parsed.action === 'approve'
      ? resolveApprove(pending)
      : resolveCancel(pending),
    {
      answerCallbackQuery: telegram.answerCallbackQuery,
      onActionError: async (err) => {
        console.error('[content-autopilot] Telegram decision failed:', err.message);
        await telegram.sendPlainMessage(
          'Не удалось завершить действие. Черновик сохранён для проверки; повторно нажимать кнопку пока не нужно.'
        );
      },
    }
  );
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

(function inspectPendingOnStartup() {
  const current = loadPending();
  if (!current) return;

  const recovery = recoverInterruptedOperation(current, new Date().toISOString());
  let pending = recovery.record;

  if (recovery.interrupted) {
    savePending(pending);
    console.error('[content-autopilot] An external Telegram operation was interrupted. Manual review is required; automatic retry is disabled.');
    telegram.sendPlainMessage(
      '⚠️ TAINA: операция с черновиком ' + pending.postId +
      ' прервалась во время отправки. Проверьте личный чат вручную. Повторная отправка заблокирована во избежание дубля.'
    ).catch(() => {
      console.error('[content-autopilot] Could not send the manual-review notice; inspect pending state on the persistent volume.');
    });
    return;
  }

  if (['published', 'cancelled', 'topic_reminder', 'approved_for_smmplanner'].includes(pending.status)) {
    console.log('[content-autopilot] Latest post is already ' + pending.status + '; no action to resume');
    return;
  }

  if (pending.status === 'needs_review') {
    console.error('[content-autopilot] Draft ' + pending.postId + ' is blocked for manual review; no automatic retry will run.');
    return;
  }

  console.log('[content-autopilot] Draft ' + pending.postId + ' is waiting for manual approval');
})();

app.listen(PORT, () => {
  console.log('TAINA SMM handoff listening on port ' + PORT);
  console.log('Schedule: "' + CRON_SCHEDULE + '" (' + TIMEZONE + '); publisher: SMMplanner (manual handoff)');
});
