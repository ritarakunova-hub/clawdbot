const express = require('express');
const cron = require('node-cron');
const { getPostForDate, todayInTimezone } = require('./src/posts');
const telegram = require('./src/telegram');
const { publish, formatPublishSummary } = require('./src/publisher');
const { loadPending, savePending, clearPending } = require('./src/pending');

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 3000;
const TIMEZONE = process.env.TIMEZONE || 'Europe/Moscow';
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 9 * * *';
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const TELEGRAM_APPROVER_ID = process.env.TELEGRAM_APPROVER_ID || process.env.TELEGRAM_CHAT_ID || '';

app.get('/health', (req, res) => res.status(200).json({ ok: true }));

function sameId(left, right) {
  return left !== undefined && right !== undefined && String(left) === String(right);
}

async function resolvePublish(pending) {
  const current = loadPending();
  if (!current || current.postId !== pending.postId || current.status !== 'awaiting_approval') {
    throw new Error('Черновик уже обработан или ожидает ручной проверки');
  }

  // Claim before network calls so duplicate Telegram callbacks cannot publish twice.
  const publishing = { ...current, status: 'publishing', approvedAt: new Date().toISOString() };
  savePending(publishing);

  const results = await publish({ text: current.text, telegramText: current.telegramText || current.text });
  const complete = results.telegram === 'ok' && results.vk === 'ok';

  if (complete) {
    clearPending();
    await telegram.markDraftDecided(
      current.telegramChatId,
      current.telegramMessageId,
      formatPublishSummary(results)
    );
    return;
  }

  savePending({ ...publishing, status: 'needs_review', lastResults: results });
  const summary = formatPublishSummary(results) +
    '\n\nПроверьте обе площадки вручную. Не запускайте повторную отправку вслепую: одна из площадок уже могла получить пост.';
  await telegram.markDraftNeedsReview(
    current.telegramChatId,
    current.telegramMessageId,
    summary,
    current.postId
  );
}

async function resolveCancel(pending) {
  const current = loadPending();
  if (!current || current.postId !== pending.postId || current.status !== 'awaiting_approval') {
    throw new Error('Этот черновик уже нельзя отменить в текущем статусе');
  }

  clearPending();
  await telegram.markDraftDecided(
    current.telegramChatId,
    current.telegramMessageId,
    '❌ Черновик отклонён. Публикации не будет.'
  );
}

async function resolveReviewed(pending) {
  const current = loadPending();
  if (!current || current.postId !== pending.postId || current.status !== 'needs_review') {
    throw new Error('Нет черновика, ожидающего ручной проверки');
  }

  clearPending();
  await telegram.markDraftDecided(
    current.telegramChatId,
    current.telegramMessageId,
    '✅ Ручная проверка отмечена. Черновик закрыт; повторную публикацию не запускали.'
  );
}

let checkInProgress = false;

async function checkAndSchedule() {
  if (checkInProgress) {
    console.log('[content-autopilot] Проверка уже выполняется — повторный запуск пропускаю');
    return;
  }

  checkInProgress = true;
  try {
    const existing = loadPending();
    if (existing) {
      console.log('[content-autopilot] Есть необработанный черновик (' +
        existing.postId + ', ' + (existing.status || 'awaiting_approval') + '). Новый не создаю.');
      return;
    }

    const today = todayInTimezone(TIMEZONE);
    const post = getPostForDate(today);
    if (!post) {
      console.log('[content-autopilot] На ' + today + ' публикация не запланирована — пропуск');
      return;
    }

    if (post.type === 'topic') {
      console.log('[content-autopilot] На ' + today + ' только тема, без текста — шлю напоминание');
      await telegram.sendTopicReminder(post);
      return;
    }

    const pending = {
      postId: post.date,
      text: post.text,
      telegramText: post.telegramText || post.text,
      telegramChatId: process.env.TELEGRAM_CHAT_ID,
      status: 'creating_draft',
      createdAt: new Date().toISOString()
    };
    savePending(pending);

    try {
      const messageId = await telegram.sendDraftPreview(post);
      savePending({
        ...pending,
        telegramMessageId: messageId,
        status: 'awaiting_approval'
      });
    } catch (err) {
      savePending({
        ...pending,
        status: 'needs_review',
        lastError: 'Не удалось однозначно подтвердить отправку черновика: ' + err.message
      });
      throw err;
    }
  } finally {
    checkInProgress = false;
  }
}

app.post('/check/now', async (req, res) => {
  try {
    await checkAndSchedule();
    res.status(200).json({
      ok: true,
      message: 'Проверка выполнена. Публикация без явного подтверждения невозможна.'
    });
  } catch (err) {
    console.error('[content-autopilot] Ошибка ручного запуска:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/telegram/webhook', async (req, res) => {
  // Fail closed: never accept publish callbacks without Telegram's secret token.
  if (!TELEGRAM_WEBHOOK_SECRET) {
    return res.status(503).json({ ok: false, error: 'TELEGRAM_WEBHOOK_SECRET не настроен' });
  }
  const header = req.headers['x-telegram-bot-api-secret-token'];
  if (header !== TELEGRAM_WEBHOOK_SECRET) {
    return res.status(401).json({ ok: false });
  }

  const callback = req.body && req.body.callback_query;
  res.status(200).json({ ok: true });
  if (!callback) return;

  const parsed = telegram.parseCallbackData(callback.data);
  const action = parsed.action;
  const postId = parsed.postId;
  const pending = loadPending();

  if (!pending || pending.postId !== postId) {
    await telegram.answerCallbackQuery(callback.id, 'Черновик уже закрыт или устарел').catch(() => {});
    return;
  }

  const messageChatId = callback.message && callback.message.chat && callback.message.chat.id;
  const actorId = callback.from && callback.from.id;
  if (!sameId(messageChatId, pending.telegramChatId) || !sameId(actorId, TELEGRAM_APPROVER_ID)) {
    await telegram.answerCallbackQuery(callback.id, 'Нет разрешения на это действие').catch(() => {});
    return;
  }

  try {
    if (action === 'publish' && pending.status === 'awaiting_approval') {
      await telegram.answerCallbackQuery(callback.id, 'Подтверждение принято. Начинаю публикацию.');
      await resolvePublish(pending);
    } else if (action === 'cancel' && pending.status === 'awaiting_approval') {
      await telegram.answerCallbackQuery(callback.id, 'Черновик отклонён.');
      await resolveCancel(pending);
    } else if (action === 'reviewed' && pending.status === 'needs_review') {
      await telegram.answerCallbackQuery(callback.id, 'Проверка отмечена.');
      await resolveReviewed(pending);
    } else {
      await telegram.answerCallbackQuery(callback.id, 'Действие недоступно для текущего статуса черновика');
    }
  } catch (err) {
    console.error('[content-autopilot] Ошибка обработки решения из Telegram:', err.message);
    await telegram.answerCallbackQuery(callback.id, 'Не удалось завершить действие. Проверьте статус сообщения.').catch(() => {});
  }
});

cron.schedule(
  CRON_SCHEDULE,
  () => {
    checkAndSchedule().catch((err) => {
      console.error('[content-autopilot] Ошибка плановой проверки:', err.message);
    });
  },
  { timezone: TIMEZONE }
);

async function resumePendingOnStartup() {
  const pending = loadPending();
  if (!pending) return;

  // Legacy drafts had a timer but no status. Ignore their deadline completely.
  if (!pending.status) {
    pending.status = 'awaiting_approval';
    delete pending.scheduledPublishAt;
    savePending(pending);
  }

  // If the process stopped while sending a preview, no publication could
  // have happened. Notify the owner, discard the orphan marker, and let the
  // next scheduled/manual check recreate a draft safely.
  if (pending.status === 'creating_draft' || (pending.status === 'needs_review' && !pending.telegramMessageId)) {
    await telegram.sendPlainMessage(
      '⚠️ Сервис прервался во время отправки черновика ' + pending.postId +
      '. Проверьте личный чат: сообщение могло прийти без сохранённой кнопки. Ничего не опубликовано автоматически.'
    ).catch((err) => console.error('[content-autopilot] Не удалось отправить уведомление о черновике:', err.message));
    clearPending();
    return;
  }

  // A crash during a network request has an ambiguous outcome.
  // Never retry automatically because one platform may already have received the post.
  if (pending.status === 'publishing') {
    pending.status = 'needs_review';
    pending.lastError = 'Сервис перезапустился во время попытки публикации';
    savePending(pending);
  }

  if (pending.status === 'needs_review') {
    await telegram.markDraftNeedsReview(
      pending.telegramChatId,
      pending.telegramMessageId,
      '⚠️ Предыдущая попытка могла пройти частично или прерваться при перезапуске. Проверьте VK и Telegram вручную. Автоматического повтора не будет.',
      pending.postId
    ).catch((err) => console.error('[content-autopilot] Не удалось обновить сообщение для ручной проверки:', err.message));
    return;
  }

  if (pending.status === 'awaiting_approval') {
    await telegram.sendPlainMessage(
      '📝 Есть черновик ' + pending.postId +
      ', который всё ещё ждёт явного решения. Без нажатия кнопки публикации не будет.'
    );
  }
}

app.listen(PORT, () => {
  console.log('TAINA Content Autopilot запущен, порт ' + PORT);
  console.log('Проверка расписания: "' + CRON_SCHEDULE + '" (' + TIMEZONE + ')');
  if (!TELEGRAM_WEBHOOK_SECRET) {
    console.error('[content-autopilot] TELEGRAM_WEBHOOK_SECRET не задан: webhook закрыт до настройки секрета');
  }
  resumePendingOnStartup().catch((err) => {
    console.error('[content-autopilot] Не удалось восстановить состояние черновика:', err.message);
  });
});
