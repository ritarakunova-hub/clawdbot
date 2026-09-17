const express = require('express');
const cron = require('node-cron');
const { getPostForDate, todayInTimezone } = require('./src/posts');
const telegram = require('./src/telegram');
const { publish, formatPublishSummary } = require('./src/publisher');
const { loadPending, savePending, clearPending } = require('./src/pending');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const TIMEZONE = process.env.TIMEZONE || 'Europe/Moscow';
// По умолчанию — каждый день в 9:00 по МСК; cron сам проверяет, есть ли
// на сегодня пост, дни без публикации просто пропускаются.
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 9 * * *';
const APPROVAL_WINDOW_MINUTES = Number(process.env.APPROVAL_WINDOW_MINUTES || 30);
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';

// postId -> таймер setTimeout, живёт только в памяти процесса.
// Если сервис перезапустится в середине окна — таймер теряется, но
// pending.json остаётся, и при старте мы либо публикуем сразу (если
// время уже прошло), либо ставим новый таймер на остаток времени.
const timers = new Map();

app.get('/health', (req, res) => res.status(200).json({ ok: true }));

/**
 * Публикует черновик (вручную или по таймеру), убирает кнопки с
 * исходного сообщения, чистит состояние и шлёт итог в личный чат.
 */
async function resolvePublish(pending, { auto }) {
  const timer = timers.get(pending.postId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(pending.postId);
  }
  clearPending();

  const results = await publish(pending.text);
  const summary = formatPublishSummary(results, { auto });

  if (pending.telegramMessageId && pending.telegramChatId) {
    await telegram.markDraftDecided(pending.telegramChatId, pending.telegramMessageId, summary);
  } else {
    await telegram.sendPlainMessage(summary);
  }
}

async function resolveCancel(pending) {
  const timer = timers.get(pending.postId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(pending.postId);
  }
  clearPending();

  const text = '❌ Отменено — автопубликации не будет. Опубликуйте вручную в VK/Telegram, если решите использовать этот текст.';
  if (pending.telegramMessageId && pending.telegramChatId) {
    await telegram.markDraftDecided(pending.telegramChatId, pending.telegramMessageId, text);
  } else {
    await telegram.sendPlainMessage(text);
  }
}

function scheduleTimeout(pending) {
  const msLeft = new Date(pending.scheduledPublishAt).getTime() - Date.now();
  const timer = setTimeout(() => {
    resolvePublish(pending, { auto: true }).catch((err) => {
      console.error('[content-autopilot] Ошибка автопубликации по таймеру:', err.message);
    });
  }, Math.max(0, msLeft));
  timers.set(pending.postId, timer);
}

/**
 * Раз в день (по расписанию) смотрит календарь на сегодня:
 * - готовый текст → шлёт черновик с кнопками, ставит таймер на автопубликацию
 * - только тема → шлёт напоминание без автопубликации (текста ещё нет)
 * - ничего не запланировано → тихо пропускает
 */
async function checkAndSchedule() {
  const today = todayInTimezone(TIMEZONE);
  const post = getPostForDate(today);
  if (!post) {
    console.log(`[content-autopilot] На ${today} публикация не запланирована — пропуск`);
    return;
  }

  if (post.type === 'topic') {
    console.log(`[content-autopilot] На ${today} только тема, без текста — шлю напоминание`);
    await telegram.sendTopicReminder(post);
    return;
  }

  console.log(`[content-autopilot] На ${today} готов текст: "${post.title}" — шлю черновик`);
  const messageId = await telegram.sendDraftPreview(post, APPROVAL_WINDOW_MINUTES);
  const pending = {
    postId: post.date,
    text: post.text,
    telegramMessageId: messageId,
    telegramChatId: process.env.TELEGRAM_CHAT_ID,
    scheduledPublishAt: new Date(Date.now() + APPROVAL_WINDOW_MINUTES * 60000).toISOString(),
  };
  savePending(pending);
  scheduleTimeout(pending);
}

// Ручной запуск — не дожидаясь расписания, удобно для проверки.
app.post('/check/now', async (req, res) => {
  try {
    await checkAndSchedule();
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[content-autopilot] Ошибка ручного запуска:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Кнопки "Опубликовать сейчас" / "Отменить" под черновиком.
app.post('/telegram/webhook', async (req, res) => {
  if (TELEGRAM_WEBHOOK_SECRET) {
    const header = req.headers['x-telegram-bot-api-secret-token'];
    if (header !== TELEGRAM_WEBHOOK_SECRET) {
      return res.status(401).json({ ok: false });
    }
  }
  res.status(200).json({ ok: true }); // отвечаем Telegram сразу, обрабатываем асинхронно

  const callback = req.body && req.body.callback_query;
  if (!callback) return;

  const { action, postId } = telegram.parseCallbackData(callback.data);
  const pending = loadPending();

  if (!pending || pending.postId !== postId) {
    try {
      await telegram.answerCallbackQuery(callback.id, 'Черновик уже устарел или обработан');
    } catch {
      // не критично
    }
    return;
  }

  try {
    if (action === 'publish') {
      await resolvePublish(pending, { auto: false });
      await telegram.answerCallbackQuery(callback.id, 'Опубликовано');
    } else if (action === 'cancel') {
      await resolveCancel(pending);
      await telegram.answerCallbackQuery(callback.id, 'Отменено');
    }
  } catch (err) {
    console.error('[content-autopilot] Ошибка обработки решения из Telegram:', err.message);
    try {
      await telegram.answerCallbackQuery(callback.id, 'Ошибка, попробуйте ещё раз');
    } catch {
      // не критично
    }
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

// При старте — если остался черновик от предыдущего запуска (сервис
// перезапустился в середине окна), не теряем его: время уже прошло —
// публикуем сразу; не прошло — ставим таймер на остаток.
(function resumePendingOnStartup() {
  const pending = loadPending();
  if (!pending) return;

  const msLeft = new Date(pending.scheduledPublishAt).getTime() - Date.now();
  if (msLeft <= 0) {
    console.log(`[content-autopilot] Найден черновик от предыдущего запуска, время истекло — публикую сейчас`);
    resolvePublish(pending, { auto: true }).catch((err) => {
      console.error('[content-autopilot] Ошибка догоняющей публикации:', err.message);
    });
  } else {
    console.log(`[content-autopilot] Найден черновик от предыдущего запуска — ставлю таймер на остаток (${Math.round(msLeft / 60000)} мин)`);
    scheduleTimeout(pending);
  }
})();

app.listen(PORT, () => {
  console.log(`TAINA Content Autopilot запущен, слушаю порт ${PORT}`);
  console.log(`Проверка расписания: "${CRON_SCHEDULE}" (${TIMEZONE}), окно на правку: ${APPROVAL_WINDOW_MINUTES} мин`);
});
