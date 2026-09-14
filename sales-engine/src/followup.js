const claude = require('./claude');
const sheets = require('./sheets');
const telegram = require('./telegram');

const FOLLOWUP_DAYS = Number(process.env.FOLLOWUP_DAYS || 3);
const MAX_FOLLOWUPS = Number(process.env.MAX_FOLLOWUPS || 2);

/**
 * ai_analysis хранится строкой вида "Факты: ...; ... | Гипотеза: ...."
 * (мы сами так её формируем в pipeline.js) — разбираем обратно.
 */
function parseAnalysis(aiAnalysis) {
  const [factsPart, hypothesisPart] = String(aiAnalysis || '').split(' | Гипотеза: ');
  const facts = (factsPart || '')
    .replace(/^Факты:\s*/, '')
    .split('; ')
    .map((s) => s.trim())
    .filter(Boolean);
  return { facts: facts.length ? facts : ['данных нет'], hypothesis: hypothesisPart || '' };
}

function daysSince(isoDate) {
  if (!isoDate) return Infinity;
  const ms = Date.now() - new Date(isoDate).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

/**
 * "Воронка, по которой сервис сам идёт": раз в день (по расписанию)
 * проверяем лидов в статусе "Отправлено" — если прошло достаточно дней
 * без ответа, готовим follow-up и присылаем на подтверждение в Telegram.
 * После MAX_FOLLOWUPS попыток лид закрывается автоматически как
 * "нет ответа", чтобы не пытаться бесконечно.
 *
 * Отправка по-прежнему требует вашего решения в Telegram — эта функция
 * только готовит черновик и напоминает, отправлять ничего сама не будет.
 */
async function runFollowUpCheck() {
  const log = (msg) => console.log(`[sales-engine:followup] ${msg}`);
  log('Проверка лидов, ожидающих follow-up...');

  let leads;
  try {
    leads = await sheets.getAllLeads();
  } catch (err) {
    log(`Ошибка чтения таблицы: ${err.message}`);
    return;
  }

  const pending = leads.filter((lead) => lead.status === 'Отправлено');
  log(`Лидов в статусе "Отправлено": ${pending.length}`);

  let drafted = 0;
  let closed = 0;

  for (const lead of pending) {
    const days = daysSince(lead.last_status_update);
    if (days < FOLLOWUP_DAYS) continue; // ещё рано

    const currentCount = Number(lead.follow_up_count) || 0;

    if (currentCount >= MAX_FOLLOWUPS) {
      await sheets.updateFields(lead.id, { status: 'Нет ответа (закрыт)' });
      log(`Закрыт без ответа: ${lead.company}`);
      closed++;
      continue;
    }

    const { facts, hypothesis } = parseAnalysis(lead.ai_analysis);
    const followUpNumber = currentCount + 1;

    let draft;
    try {
      draft = await claude.draftFollowUp({
        company: lead.company,
        niche: lead.niche,
        city: lead.city,
        facts,
        hypothesis,
        originalMessage: lead.message,
        followUpNumber,
        daysSinceContact: Math.round(days),
      });
    } catch (err) {
      log(`Ошибка генерации follow-up для "${lead.company}": ${err.message}`);
      continue;
    }

    await sheets.updateFields(lead.id, {
      message: draft.message,
      status: 'Готов к проверке',
      follow_up_count: followUpNumber,
      score_reason: `Follow-up ${followUpNumber}/${MAX_FOLLOWUPS} — прошло ${Math.round(days)} дн. без ответа`,
    });

    try {
      await telegram.sendLeadCard({
        ...lead,
        message: draft.message,
        follow_up_count: followUpNumber,
        score_reason: `Прошло ${Math.round(days)} дн. без ответа на предыдущее сообщение`,
      });
      drafted++;
    } catch (err) {
      log(`Ошибка отправки follow-up карточки "${lead.company}": ${err.message}`);
    }
  }

  const summary = `🔁 Проверка follow-up завершена.\nЧерновиков подготовлено: ${drafted}\nЗакрыто без ответа: ${closed}`;
  log(summary.replace(/\n/g, ' | '));
  try {
    await telegram.sendPlainMessage(summary);
  } catch (err) {
    log(`Не удалось отправить итог в Telegram: ${err.message}`);
  }
}

module.exports = { runFollowUpCheck, parseAnalysis, daysSince, FOLLOWUP_DAYS, MAX_FOLLOWUPS };
