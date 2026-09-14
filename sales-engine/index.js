const express = require('express');
const cron = require('node-cron');
const { runPipeline } = require('./src/pipeline');
const { runFollowUpCheck } = require('./src/followup');
const sheets = require('./src/sheets');
const telegram = require('./src/telegram');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const APP_USERNAME = process.env.APP_USERNAME || '';
const APP_PASSWORD = process.env.APP_PASSWORD || '';
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
// По умолчанию — каждый день в 10:00 по времени сервера (Amvera — обычно МСК).
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 10 * * *';

app.get('/health', (req, res) => res.status(200).json({ ok: true }));

// Простая защита формы паролем через стандартное окно браузера (Basic Auth) —
// чтобы случайный человек в интернете не мог жать "Найти лидов" за ваш счёт.
// Если APP_USERNAME/APP_PASSWORD не заданы — защита выключена (только для локальных тестов).
function requireAuth(req, res, next) {
  if (!APP_USERNAME || !APP_PASSWORD) return next();

  const header = req.headers.authorization || '';
  const [, encoded] = header.split(' ');
  const decoded = encoded ? Buffer.from(encoded, 'base64').toString('utf-8') : '';
  const [user, pass] = decoded.split(':');

  if (user === APP_USERNAME && pass === APP_PASSWORD) return next();

  res.set('WWW-Authenticate', 'Basic realm="TAINA Sales Engine"');
  return res.status(401).send('Требуется авторизация');
}

app.get('/', requireAuth, (req, res) => {
  res.status(200).send(`<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>TAINA Sales Engine</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 480px; margin: 60px auto; padding: 0 16px; }
  h1 { font-size: 20px; }
  label { display: block; margin-top: 16px; font-size: 14px; color: #333; }
  input { width: 100%; padding: 8px; font-size: 16px; box-sizing: border-box; margin-top: 4px; }
  button { margin-top: 24px; padding: 12px 20px; font-size: 16px; background: #111; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
  button:hover { background: #333; }
  p.hint { color: #666; font-size: 13px; }
</style>
</head>
<body>
  <h1>🎯 TAINA Sales Engine</h1>
  <p class="hint">Найдёт компании через Google Maps, проанализирует и пришлёт хорошие лиды в Telegram.</p>
  <form method="POST" action="/run">
    <label>Ниша
      <input name="niche" placeholder="например: медицинские центры" required>
    </label>
    <label>Город
      <input name="city" placeholder="например: Москва" required>
    </label>
    <label>Сколько компаний искать (10-30)
      <input name="limit" type="number" min="1" max="30" value="10" required>
    </label>
    <button type="submit">Найти лидов</button>
  </form>

  <hr style="margin-top: 40px; border: none; border-top: 1px solid #eee;">
  <p class="hint">Follow-up лидам без ответа обычно проверяется само раз в день.
  Кнопка ниже — чтобы проверить прямо сейчас, не дожидаясь расписания (удобно для теста).</p>
  <form method="POST" action="/followup/run">
    <button type="submit" style="background:#555;">🔁 Проверить follow-up сейчас</button>
  </form>
</body>
</html>`);
});

app.post('/run', requireAuth, (req, res) => {
  const niche = String(req.body.niche || '').trim();
  const city = String(req.body.city || '').trim();
  const limit = Math.min(30, Math.max(1, Number(req.body.limit) || 10));

  if (!niche || !city) {
    return res.status(400).send('Нужно указать нишу и город.');
  }

  // Прогон может занять несколько минут (сайты + несколько вызовов Claude
  // на компанию) — не держим браузер/Amvera в ожидании, отвечаем сразу,
  // а результаты придут в Telegram по мере готовности.
  res.status(200).send(`<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>Запущено</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 60px auto; padding: 0 16px;">
<h2>Запущено ✅</h2>
<p>Ищу компании: «${niche}», ${city}, до ${limit} шт.</p>
<p>Хорошие лиды придут карточками в Telegram. Когда прогон закончится — там же будет итоговое сообщение.</p>
<p><a href="/">← Запустить ещё раз</a></p>
</body></html>`);

  runPipeline({ niche, city, limit }).catch((err) => {
    console.error('[sales-engine] Необработанная ошибка прогона:', err);
  });
});

app.post('/followup/run', requireAuth, (req, res) => {
  res.status(200).send(`<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>Запущено</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 60px auto; padding: 0 16px;">
<h2>Проверка follow-up запущена ✅</h2>
<p>Если есть лиды без ответа дольше положенного срока — их черновики придут в Telegram.</p>
<p><a href="/">← Назад</a></p>
</body></html>`);

  runFollowUpCheck().catch((err) => {
    console.error('[sales-engine] Необработанная ошибка проверки follow-up:', err);
  });
});

// Вебхук Telegram — сюда прилетают нажатия кнопок на карточках лидов.
app.post('/telegram/webhook', async (req, res) => {
  if (TELEGRAM_WEBHOOK_SECRET) {
    const header = req.headers['x-telegram-bot-api-secret-token'];
    if (header !== TELEGRAM_WEBHOOK_SECRET) {
      return res.status(401).json({ ok: false });
    }
  }

  // Отвечаем Telegram сразу 200 — дальше обрабатываем асинхронно,
  // чтобы вебхук не считался "зависшим" при медленной записи в таблицу.
  res.status(200).json({ ok: true });

  const update = req.body;
  const callback = update && update.callback_query;
  if (!callback) return;

  const [action, id] = String(callback.data || '').split(':');
  if (!id) return;

  // "Одобрить" сразу переводит лида в "Отправлено" — это старт отсчёта
  // до follow-up. Предполагается, что вы копируете текст и отправляете
  // его в ближайшее время после нажатия (см. README, раздел "Воронка").
  const statusMap = {
    approve: 'Отправлено',
    reject: 'Отклонён',
    edit: 'Нужна правка',
  };
  const statusLabel = statusMap[action];
  if (!statusLabel) return;

  try {
    const updated = action === 'approve'
      ? await sheets.markApproved(id)
      : await sheets.updateStatus(id, statusLabel);
    if (!updated) {
      await telegram.answerCallbackQuery(callback.id, 'Лид не найден в таблице — возможно, удалён');
      return;
    }

    await telegram.answerCallbackQuery(callback.id, `Статус: ${statusLabel}`);

    const chatId = callback.message && callback.message.chat && callback.message.chat.id;
    const messageId = callback.message && callback.message.message_id;
    if (chatId && messageId) {
      await telegram.markCardDecided(chatId, messageId, statusLabel);
    }

    if (action === 'approve') {
      const lead = await sheets.getLeadById(id);
      if (lead && lead.message) {
        await telegram.sendPlainMessage(`📋 Текст для отправки (${lead.company}):\n\n${lead.message}`);
      }
    }
  } catch (err) {
    console.error('[sales-engine] Ошибка обработки решения из Telegram:', err.message);
    try {
      await telegram.answerCallbackQuery(callback.id, 'Ошибка, попробуйте ещё раз');
    } catch {
      // не критично
    }
  }
});

// "Воронка, по которой сервис сам идёт": раз в день без вашего участия
// проверяет лидов без ответа и готовит follow-up-черновики (не отправляет).
cron.schedule(CRON_SCHEDULE, () => {
  console.log('[sales-engine] Запуск плановой проверки follow-up по расписанию');
  runFollowUpCheck().catch((err) => {
    console.error('[sales-engine] Ошибка плановой проверки follow-up:', err);
  });
});

app.listen(PORT, () => {
  console.log(`TAINA Sales Engine запущен, слушаю порт ${PORT}`);
  console.log(`Follow-up по расписанию: "${CRON_SCHEDULE}"`);
});
