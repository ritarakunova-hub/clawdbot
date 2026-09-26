const express = require('express');
const claude = require('./src/claude');
const sheets = require('./src/sheets');
const telegram = require('./src/telegram');
const vk = require('./src/vk');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const APP_USERNAME = process.env.APP_USERNAME || '';
const APP_PASSWORD = process.env.APP_PASSWORD || '';
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

app.get('/health', (req, res) => res.status(200).json({ ok: true }));

// Простая защита формы паролем через стандартное окно браузера (Basic Auth) —
// чтобы случайный человек в интернете не мог генерировать посты за ваш счёт.
function requireAuth(req, res, next) {
  if (!APP_USERNAME || !APP_PASSWORD) return next();

  const header = req.headers.authorization || '';
  const [, encoded] = header.split(' ');
  const decoded = encoded ? Buffer.from(encoded, 'base64').toString('utf-8') : '';
  const [user, pass] = decoded.split(':');

  if (user === APP_USERNAME && pass === APP_PASSWORD) return next();

  res.set('WWW-Authenticate', 'Basic realm="TAINA Content Engine"');
  return res.status(401).send('Требуется авторизация');
}

app.get('/', requireAuth, (req, res) => {
  res.status(200).send(`<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>TAINA Content Engine</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 480px; margin: 60px auto; padding: 0 16px; }
  h1 { font-size: 20px; }
  label { display: block; margin-top: 16px; font-size: 14px; color: #333; }
  input, textarea { width: 100%; padding: 8px; font-size: 16px; box-sizing: border-box; margin-top: 4px; font-family: inherit; }
  textarea { resize: vertical; }
  .checkboxes label { display: inline-flex; align-items: center; gap: 6px; margin-right: 16px; font-size: 14px; }
  .checkboxes input { width: auto; margin: 0; }
  button { margin-top: 24px; padding: 12px 20px; font-size: 16px; background: #111; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
  button:hover { background: #333; }
  p.hint { color: #666; font-size: 13px; }
</style>
</head>
<body>
  <h1>✍️ TAINA Content Engine</h1>
  <p class="hint">Claude напишет пост по теме, черновик придёт вам в Telegram
  с кнопками — публикация только после вашего «Опубликовать».</p>
  <form method="POST" action="/generate">
    <label>Тема поста
      <input name="topic" placeholder="например: почему RAG-бот лучше обычного FAQ" required>
    </label>
    <label>Бриф / детали (необязательно)
      <textarea name="brief" rows="4" placeholder="ключевые тезисы, факты, тон..."></textarea>
    </label>
    <label>Куда публиковать
      <div class="checkboxes">
        <label><input type="checkbox" name="platforms" value="telegram" checked> Telegram-канал</label>
        <label><input type="checkbox" name="platforms" value="vk"> VK</label>
      </div>
    </label>
    <button type="submit">Сгенерировать черновик</button>
  </form>
</body>
</html>`);
});

app.post('/generate', requireAuth, async (req, res) => {
  const topic = String(req.body.topic || '').trim();
  const brief = String(req.body.brief || '').trim();
  const platforms = [].concat(req.body.platforms || []).filter(Boolean);

  if (!topic) {
    return res.status(400).send('Нужно указать тему поста.');
  }
  if (!platforms.length) {
    return res.status(400).send('Выберите хотя бы одну платформу.');
  }

  try {
    const draft = await claude.generatePost({ topic, brief });

    const post = {
      id: generateId(),
      topic,
      brief,
      text: draft.text,
      hashtags: draft.hashtags.join(', '),
      platforms: platforms.join(', '),
      status: 'Готов к проверке',
      created_at: new Date().toISOString(),
      last_status_update: new Date().toISOString(),
      telegram_message_id: '',
      published_at: '',
      notes: '',
    };

    await sheets.appendPost(post);
    const messageId = await telegram.sendDraftCard(post);
    if (messageId) {
      await sheets.updateFields(post.id, { telegram_message_id: String(messageId) });
    }

    res.status(200).send(`<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>Готово</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 60px auto; padding: 0 16px;">
<h2>Черновик готов ✅</h2>
<p>Пришёл вам в Telegram — нажмите «Опубликовать», когда будете готовы.</p>
<p><a href="/">← Сгенерировать ещё</a></p>
</body></html>`);
  } catch (err) {
    console.error('[content-engine] Ошибка генерации поста:', err.message);
    res.status(500).send(`Ошибка генерации: ${err.message}`);
  }
});

// Вебхук Telegram — сюда прилетают нажатия кнопок на карточках-черновиках.
app.post('/telegram/webhook', async (req, res) => {
  if (TELEGRAM_WEBHOOK_SECRET) {
    const header = req.headers['x-telegram-bot-api-secret-token'];
    if (header !== TELEGRAM_WEBHOOK_SECRET) {
      return res.status(401).json({ ok: false });
    }
  }

  // Отвечаем Telegram сразу 200 — публикация обрабатывается асинхронно.
  res.status(200).json({ ok: true });

  const update = req.body;
  const callback = update && update.callback_query;
  if (!callback) return;

  const [action, id] = String(callback.data || '').split(':');
  if (!id) return;

  const chatId = callback.message && callback.message.chat && callback.message.chat.id;
  const messageId = callback.message && callback.message.message_id;

  try {
    if (action === 'reject') {
      const updated = await sheets.updateStatus(id, 'Отклонён');
      if (!updated) {
        await telegram.answerCallbackQuery(callback.id, 'Пост не найден в таблице');
        return;
      }
      await telegram.answerCallbackQuery(callback.id, 'Отклонён');
      if (chatId && messageId) await telegram.markCardDecided(chatId, messageId, 'Отклонён');
      return;
    }

    if (action === 'edit') {
      const updated = await sheets.updateStatus(id, 'Нужна правка');
      if (!updated) {
        await telegram.answerCallbackQuery(callback.id, 'Пост не найден в таблице');
        return;
      }
      // Кнопки специально НЕ убираем: отредактируйте text/hashtags в
      // таблице и нажмите "Опубликовать" на этой же карточке ещё раз.
      await telegram.answerCallbackQuery(
        callback.id,
        'Отредактируйте текст/хэштеги в таблице (по id) и нажмите «Опубликовать» на этой карточке ещё раз'
      );
      return;
    }

    if (action === 'approve') {
      const post = await sheets.getPostById(id);
      if (!post) {
        await telegram.answerCallbackQuery(callback.id, 'Пост не найден в таблице');
        return;
      }

      const text = telegram.formatPostText(post);
      const platforms = String(post.platforms || '').split(',').map((p) => p.trim().toLowerCase());
      const results = [];

      if (platforms.includes('telegram')) {
        try {
          await telegram.publishToChannel(text);
          results.push('Telegram ✅');
        } catch (err) {
          results.push(`Telegram ❌ ${err.message}`);
        }
      }

      if (platforms.includes('vk')) {
        try {
          const result = await vk.publishToWall(text);
          results.push(result.skipped ? 'VK — пропущено (не настроен VK_ACCESS_TOKEN/VK_GROUP_ID)' : 'VK ✅');
        } catch (err) {
          results.push(`VK ❌ ${err.message}`);
        }
      }

      await sheets.updateFields(id, {
        status: 'Опубликован',
        published_at: new Date().toISOString(),
        notes: results.join('; '),
      });

      await telegram.answerCallbackQuery(callback.id, 'Опубликовано');
      if (chatId && messageId) {
        await telegram.markCardDecided(chatId, messageId, `Опубликован (${results.join(', ')})`);
      }
    }
  } catch (err) {
    console.error('[content-engine] Ошибка обработки решения из Telegram:', err.message);
    try {
      await telegram.answerCallbackQuery(callback.id, 'Ошибка, попробуйте ещё раз');
    } catch {
      // не критично
    }
  }
});

app.listen(PORT, () => {
  console.log(`TAINA Content Engine запущен, слушаю порт ${PORT}`);
});
