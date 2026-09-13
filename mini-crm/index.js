const express = require('express');
const { parseNetlifyLead } = require('./src/lead');
const { appendLead } = require('./src/sheets');
const { notifyNewLead } = require('./src/telegram');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
// Необязательный секрет в URL вебхука, чтобы левые запросы не писали мусор в таблицу.
// Если WEBHOOK_SECRET не задан — проверка пропускается (для первого теста).
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

app.get('/health', (req, res) => {
  res.status(200).json({ ok: true });
});

app.post('/webhook/netlify-lead', async (req, res) => {
  if (WEBHOOK_SECRET && req.query.token !== WEBHOOK_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  let lead;
  try {
    lead = parseNetlifyLead(req.body);
  } catch (err) {
    console.error('Не удалось разобрать заявку:', err, 'body =', req.body);
    return res.status(400).json({ ok: false, error: 'bad_payload' });
  }

  try {
    await appendLead(lead);
  } catch (err) {
    console.error('Ошибка записи заявки в Google Sheets:', err.message);
    return res.status(500).json({ ok: false, error: 'sheets_error' });
  }

  console.log('Новая заявка записана:', lead.name || lead.email || lead.phone || '(без контакта)');

  // Заявка уже в таблице — это главное. Если Telegram недоступен,
  // запрос всё равно считаем успешным, просто логируем ошибку.
  try {
    await notifyNewLead(lead);
  } catch (err) {
    console.error('Ошибка отправки уведомления в Telegram:', err.message);
  }

  return res.status(200).json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`TAINA mini-CRM запущена, слушаю порт ${PORT}`);
});
