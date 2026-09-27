const express = require('express');
const cron = require('node-cron');
const { getPostForDate, loadPosts, setPostText, todayInTimezone } = require('./src/posts');
const telegram = require('./src/telegram');
const { publish, formatPublishSummary } = require('./src/publisher');
const { loadPending, savePending, clearPending } = require('./src/pending');
const claude = require('./src/claude');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const TIMEZONE = process.env.TIMEZONE || 'Europe/Moscow';
const APP_USERNAME = process.env.APP_USERNAME || '';
const APP_PASSWORD = process.env.APP_PASSWORD || '';
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

// Простая защита формы паролем через стандартное окно браузера (Basic Auth) —
// чтобы случайный человек в интернете не мог тратить ANTHROPIC_API_KEY за ваш счёт.
// Если APP_USERNAME/APP_PASSWORD не заданы — защита выключена (только для локальных тестов).
function requireAuth(req, res, next) {
  if (!APP_USERNAME || !APP_PASSWORD) return next();

  const header = req.headers.authorization || '';
  const [, encoded] = header.split(' ');
  const decoded = encoded ? Buffer.from(encoded, 'base64').toString('utf-8') : '';
  const [user, pass] = decoded.split(':');

  if (user === APP_USERNAME && pass === APP_PASSWORD) return next();

  res.set('WWW-Authenticate', 'Basic realm="TAINA Content Autopilot"');
  return res.status(401).send('Требуется авторизация');
}

/**
 * Форма для дозаписи текста к теме из календаря — темы без текста
 * (type: "topic") показаны как варианты выбора.
 */
app.get('/', requireAuth, (req, res) => {
  const topics = loadPosts().filter((p) => p.type === 'topic');
  const options = topics
    .map((p) => `<option value="${p.date}">${p.date} · ${p.rubric} · ${p.title}</option>`)
    .join('\n');

  res.status(200).send(`<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>TAINA Content Autopilot</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 480px; margin: 60px auto; padding: 0 16px; }
  h1 { font-size: 20px; }
  label { display: block; margin-top: 16px; font-size: 14px; color: #333; }
  select, textarea { width: 100%; padding: 8px; font-size: 16px; box-sizing: border-box; margin-top: 4px; font-family: inherit; }
  textarea { resize: vertical; }
  button { margin-top: 24px; padding: 12px 20px; font-size: 16px; background: #111; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
  button:hover { background: #333; }
  p.hint { color: #666; font-size: 13px; }
</style>
</head>
<body>
  <h1>✍️ Дописать текст к теме</h1>
  <p class="hint">Claude напишет текст в голосе Маргариты для выбранной темы из
  календаря и сохранит его в <code>data/posts.json</code> — дальше тема пойдёт
  по обычному расписанию (черновик в Telegram → таймер → публикация).</p>
  ${topics.length ? `<form method="POST" action="/generate-text">
    <label>Тема из календаря (${topics.length} без текста)
      <select name="date" required>
        ${options}
      </select>
    </label>
    <label>Заметки/детали (необязательно)
      <textarea name="notes" rows="4" placeholder="что важно упомянуть, конкретный факт, тон..."></textarea>
    </label>
    <button type="submit">Сгенерировать текст</button>
  </form>` : '<p class="hint">Все темы в календаре уже с текстом.</p>'}
</body>
</html>`);
});

app.post('/generate-text', requireAuth, async (req, res) => {
  const date = String(req.body.date || '').trim();
  const notes = String(req.body.notes || '').trim();

  const post = getPostForDate(date);
  if (!post) {
    return res.status(400).send('Дата не найдена в календаре.');
  }

  try {
    const text = await claude.generateText({ rubric: post.rubric, title: post.title, notes });
    setPostText(date, text);

    try {
      await telegram.sendPlainMessage(
        `✍️ Текст к теме «${post.title}» (${post.rubric}, ${date}) готов и сохранён в календаре:\n\n${text}`
      );
    } catch (err) {
      console.error('[content-autopilot] Не удалось отправить предпросмотр в Telegram:', err.message);
    }

    res.status(200).send(`<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>Готово</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 60px auto; padding: 0 16px;">
<h2>Текст сохранён ✅</h2>
<p>Тема «${post.title}» (${date}) теперь с текстом — придёт черновиком в Telegram
в свой день по расписанию. Копия текста для проверки прямо сейчас пришла вам в Telegram.</p>
<p style="color:#a60;">⚠️ Текст сохранён на диске контейнера, не в репозитории.
Если сервис перезапустится/передеплоится раньше, чем эта тема будет опубликована —
текст пропадёт. Чтобы закрепить навсегда, скопируйте его из Telegram в
<code>data/posts.json</code> в репозитории и запушьте (или попросите меня).</p>
<p><a href="/">← Дописать ещё одну тему</a></p>
</body></html>`);
  } catch (err) {
    console.error('[content-autopilot] Ошибка генерации текста:', err.message);
    res.status(500).send(`Ошибка генерации: ${err.message}`);
  }
});

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
