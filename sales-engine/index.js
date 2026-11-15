const crypto = require('node:crypto');
const express = require('express');
const cron = require('node-cron');
const { runPipeline } = require('./src/pipeline');
const { runFollowUpCheck } = require('./src/followup');
const sheets = require('./src/sheets');
const telegram = require('./src/telegram');
const {
  safeEqual,
  verifyBasicAuth,
  verifyCsrf,
  verifyTelegramCallback,
  escapeHtml,
  safePositiveInteger
} = require('./src/security');

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  next();
});
app.use(express.json({ limit: '16kb', inflate: false }));
app.use(express.urlencoded({ extended: false, limit: '16kb', inflate: false }));

const PORT = process.env.PORT || 3000;
const APP_USERNAME = process.env.APP_USERNAME || '';
const APP_PASSWORD = process.env.APP_PASSWORD || '';
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const TELEGRAM_ADMIN_USER_ID = process.env.TELEGRAM_ADMIN_USER_ID || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 10 * * *';
let activeOperation = null;

function requireAuth(req, res, next) {
  if (!APP_USERNAME || !APP_PASSWORD) {
    return res.status(503).send('Сервис закрыт: авторизация не настроена.');
  }
  if (verifyBasicAuth(req.headers.authorization, APP_USERNAME, APP_PASSWORD)) return next();
  res.set('WWW-Authenticate', 'Basic realm="TAINA Sales Engine", charset="UTF-8"');
  return res.status(401).send('Требуется авторизация');
}

function requireCsrf(req, res, next) {
  if (!verifyCsrf(req, req.headers.host || '')) {
    return res.status(403).send('Проверка запроса не пройдена. Обновите страницу и повторите действие.');
  }
  return next();
}

function acquireOperation(name) {
  if (activeOperation) return false;
  activeOperation = name;
  return true;
}

function releaseOperation(name) {
  if (activeOperation === name) activeOperation = null;
}

function runExclusive(name, task) {
  if (!acquireOperation(name)) {
    console.log('[sales-engine] operation_skipped_busy');
    return Promise.resolve(false);
  }
  return Promise.resolve()
    .then(task)
    .catch(() => {
      console.error('[sales-engine] operation_failed');
      return false;
    })
    .finally(() => releaseOperation(name));
}

function makeCsrfCookie(token) {
  const secure = process.env.NODE_ENV === 'production';
  const cookieName = secure ? '__Host-taina-csrf' : 'taina-csrf';
  return {
    name: cookieName,
    value: secure
      ? token + '; Path=/; Max-Age=3600; Secure; HttpOnly; SameSite=Strict'
      : token + '; Path=/; Max-Age=3600; HttpOnly; SameSite=Strict'
  };
}

app.get('/health', (req, res) => res.status(200).json({ ok: true }));

app.get('/', requireAuth, (req, res) => {
  const csrfToken = crypto.randomBytes(32).toString('base64url');
  const cookie = makeCsrfCookie(csrfToken);
  res.setHeader('Set-Cookie', cookie.name + '=' + cookie.value);

  res.status(200).send(`<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
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
  <h1>TAINA Sales Engine</h1>
  <p class="hint">Поиск и подготовка лидов. Перед отправкой сообщения требуется ручное подтверждение.</p>
  <form method="POST" action="/run">
    <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}">
    <label>Ниша
      <input name="niche" maxlength="120" placeholder="например: сервисные компании" required>
    </label>
    <label>Город
      <input name="city" maxlength="120" placeholder="например: Санкт-Петербург" required>
    </label>
    <label>Сколько компаний искать (1–30)
      <input name="limit" type="number" min="1" max="30" value="10" required>
    </label>
    <button type="submit">Найти лидов</button>
  </form>

  <hr style="margin-top: 40px; border: none; border-top: 1px solid #eee;">
  <p class="hint">Проверка follow-up только готовит черновики и не отправляет сообщения автоматически.</p>
  <form method="POST" action="/followup/run">
    <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}">
    <button type="submit" style="background:#555;">Проверить follow-up сейчас</button>
  </form>
</body>
</html>`);
});

app.post('/run', requireAuth, requireCsrf, (req, res) => {
  const rawNiche = typeof req.body.niche === 'string' ? req.body.niche : '';
  const rawCity = typeof req.body.city === 'string' ? req.body.city : '';
  const niche = rawNiche.trim();
  const city = rawCity.trim();
  const rawLimit = typeof req.body.limit === 'string' ? req.body.limit : '';

  if (!niche || niche.length > 120 || !city || city.length > 120 ||
      !/^[1-9]\d?$/.test(rawLimit) || Number(rawLimit) > 30) {
    return res.status(400).send('Проверьте нишу, город и лимит (1–30).');
  }
  if (!acquireOperation('pipeline')) {
    return res.status(409).send('Другая операция уже выполняется. Повторите позже.');
  }

  res.status(202).send(`<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>Запущено</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 60px auto; padding: 0 16px;">
<h2>Поиск запущен</h2>
<p>Ищу компании: «${escapeHtml(niche)}», ${escapeHtml(city)}, до ${Number(rawLimit)} шт.</p>
<p>Подготовленные карточки придут в Telegram. Отправка сообщений требует вашего подтверждения.</p>
<p><a href="/">Назад</a></p>
</body></html>`);

  void Promise.resolve()
    .then(() => runPipeline({ niche, city, limit: Number(rawLimit) }))
    .catch(() => console.error('[sales-engine] pipeline_failed'))
    .finally(() => releaseOperation('pipeline'));
});

app.post('/followup/run', requireAuth, requireCsrf, (req, res) => {
  if (!acquireOperation('followup')) {
    return res.status(409).send('Другая операция уже выполняется. Повторите позже.');
  }
  res.status(202).send('Проверка follow-up запущена. Черновики, если они есть, придут в Telegram.');
  void Promise.resolve()
    .then(() => runFollowUpCheck())
    .catch(() => console.error('[sales-engine] followup_failed'))
    .finally(() => releaseOperation('followup'));
});

app.post('/telegram/webhook', async (req, res) => {
  if (!TELEGRAM_WEBHOOK_SECRET || !TELEGRAM_ADMIN_USER_ID ||
      !safePositiveInteger(TELEGRAM_ADMIN_USER_ID) || !TELEGRAM_CHAT_ID) {
    return res.status(503).json({ ok: false, error: 'webhook_not_configured' });
  }
  const suppliedSecret = req.get('x-telegram-bot-api-secret-token') || '';
  if (!safeEqual(suppliedSecret, TELEGRAM_WEBHOOK_SECRET)) {
    return res.status(401).json({ ok: false });
  }

  const callback = req.body && req.body.callback_query;
  if (!callback) return res.status(200).json({ ok: true });
  if (!verifyTelegramCallback(callback, TELEGRAM_ADMIN_USER_ID, TELEGRAM_CHAT_ID)) {
    return res.status(403).json({ ok: false });
  }

  const parts = String(callback.data || '').split(':');
  const action = parts[0];
  const id = parts[1];
  if (parts.length !== 2 || !['approve', 'reject', 'edit'].includes(action) ||
      typeof id !== 'string' || !/^[a-z0-9_-]{1,64}$/i.test(id)) {
    return res.status(400).json({ ok: false });
  }
  if (!acquireOperation('telegram-callback')) {
    return res.status(409).json({ ok: false, error: 'busy' });
  }

  res.status(200).json({ ok: true });
  const statusMap = { approve: 'Отправлено', reject: 'Отклонён', edit: 'Нужна правка' };
  const statusLabel = statusMap[action];

  try {
    const lead = await sheets.getLeadById(id);
    if (!lead || lead.status !== 'Готов к проверке') {
      await telegram.answerCallbackQuery(callback.id, 'Карточка уже обработана или не найдена');
      return;
    }

    const updated = action === 'approve'
      ? await sheets.markApproved(id)
      : await sheets.updateStatus(id, statusLabel);
    if (!updated) {
      await telegram.answerCallbackQuery(callback.id, 'Лид не найден');
      return;
    }

    await telegram.answerCallbackQuery(callback.id, 'Статус: ' + statusLabel);
    const message = callback.message;
    await telegram.markCardDecided(message.chat.id, message.message_id, statusLabel);

    if (action === 'approve') {
      const approvedLead = await sheets.getLeadById(id);
      if (approvedLead && approvedLead.message) {
        await telegram.sendPlainMessage('Текст для отправки (' +
          approvedLead.company + '):\n\n' + approvedLead.message);
      }
    }
  } catch {
    console.error('[sales-engine] telegram_callback_failed');
    try {
      await telegram.answerCallbackQuery(callback.id, 'Ошибка обработки. Проверьте таблицу.');
    } catch {}
  } finally {
    releaseOperation('telegram-callback');
  }
});

if (!cron.validate(CRON_SCHEDULE)) {
  throw new Error('CRON_SCHEDULE имеет неверный формат');
}
cron.schedule(CRON_SCHEDULE, () => {
  void runExclusive('followup', runFollowUpCheck);
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err && (err.type === 'entity.too.large' || err.status === 413) ? 413 : 400;
  res.status(status).json({ ok: false, error: status === 413 ? 'payload_too_large' : 'invalid_request' });
});

app.listen(PORT, () => {
  console.log('[sales-engine] service_started');
  if (!APP_USERNAME || !APP_PASSWORD || !TELEGRAM_WEBHOOK_SECRET ||
      !safePositiveInteger(TELEGRAM_ADMIN_USER_ID) || !TELEGRAM_CHAT_ID) {
    console.error('[sales-engine] security_configuration_incomplete; privileged routes remain closed');
  }
});
