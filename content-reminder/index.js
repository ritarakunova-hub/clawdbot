const express = require('express');
const cron = require('node-cron');
const { getPostForDate, todayInTimezone } = require('./src/posts');
const { sendReminder } = require('./src/telegram');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const TIMEZONE = process.env.TIMEZONE || 'Europe/Moscow';
// По умолчанию — каждый день в 9:00 по МСК (cron сам проверяет, есть ли
// на сегодня пост в календаре; в дни без публикации просто ничего не шлёт).
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 9 * * *';
const REMINDER_SECRET = process.env.REMINDER_SECRET || '';

app.get('/health', (req, res) => res.status(200).json({ ok: true }));

/**
 * Проверяет календарь на сегодня (по МСК) и, если есть запись —
 * шлёт напоминание в Telegram. Если записи нет — тихо ничего не делает,
 * это нормально в дни, когда публикация не запланирована.
 */
async function checkAndRemind() {
  const today = todayInTimezone(TIMEZONE);
  const post = getPostForDate(today);
  if (!post) {
    console.log(`[content-reminder] На ${today} публикация не запланирована — пропуск`);
    return;
  }
  console.log(`[content-reminder] Публикация на ${today}: "${post.title}" (${post.type})`);
  await sendReminder(post);
}

// Ручной запуск — удобно для проверки, не дожидаясь расписания.
// Необязательный секрет в query, чтобы случайный запрос не слал вам спам.
app.post('/remind/now', async (req, res) => {
  if (REMINDER_SECRET && req.query.token !== REMINDER_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  try {
    await checkAndRemind();
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[content-reminder] Ошибка ручного запуска:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

cron.schedule(
  CRON_SCHEDULE,
  () => {
    checkAndRemind().catch((err) => {
      console.error('[content-reminder] Ошибка плановой проверки:', err.message);
    });
  },
  { timezone: TIMEZONE }
);

app.listen(PORT, () => {
  console.log(`TAINA Content Reminder запущен, слушаю порт ${PORT}`);
  console.log(`Проверка расписания: "${CRON_SCHEDULE}" (${TIMEZONE})`);
});
