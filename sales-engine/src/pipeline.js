const leadSource = require('./webLeadSearch');
const { fetchSiteText } = require('./siteFetch');
const claude = require('./claude');
const { computeScore, digitalPresenceCriterion } = require('./scoring');
const sheets = require('./sheets');
const telegram = require('./telegram');

const SCORE_THRESHOLD = Number(process.env.SCORE_THRESHOLD || 70);

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function buildLeadKey(domain, company, city) {
  return domain || `${sheets.normalizeKey(company)}|${sheets.normalizeKey(city)}`;
}

/**
 * Основной прогон: найти компании → отсеять дубли → проанализировать →
 * оценить → для хороших подготовить сообщение → сохранить → уведомить.
 *
 * Ошибка на одной компании не должна ронять весь прогон — остальные
 * лиды всё равно должны обработаться.
 */
async function runPipeline({ niche, city, limit }) {
  const log = (msg) => console.log(`[sales-engine] ${msg}`);

  log(`Старт: ниша="${niche}", город="${city}", лимит=${limit}`);

  let rawResults;
  try {
    rawResults = await leadSource.searchCompanies(niche, city, limit);
  } catch (err) {
    log(`Ошибка поиска лидов: ${err.message}`);
    await telegram.sendPlainMessage(`⚠️ Прогон остановлен: ошибка веб-поиска лидов.\n${err.message}`);
    return;
  }

  log(`Веб-поиск вернул ${rawResults.length} компаний`);

  const existingKeys = await sheets.getExistingKeys();

  let processed = 0;
  let qualified = 0;

  for (const place of rawResults) {
    if (processed >= limit) break;

    const domain = leadSource.normalizeDomain(place.site);
    const key = buildLeadKey(domain, place.name, city);

    if (existingKeys.has(key)) {
      log(`Пропуск (уже есть в базе): ${place.name}`);
      continue;
    }
    existingKeys.add(key); // не обработать эту же компанию дважды в рамках прогона

    let siteText = null;
    if (place.site) {
      siteText = await fetchSiteText(place.site);
    }

    let analysis;
    try {
      analysis = await claude.analyzeCompany({
        company: place.name,
        niche,
        city,
        siteText,
        contacts: place.phone,
      });
    } catch (err) {
      log(`Ошибка анализа "${place.name}": ${err.message}`);
      continue;
    }

    const criteria = {
      ...analysis.criteria,
      digital_presence_quality: digitalPresenceCriterion(siteText),
    };
    const { score, reason } = computeScore(criteria);

    let problem = '';
    let solution = '';
    let message = '';

    if (score >= SCORE_THRESHOLD) {
      try {
        const draft = await claude.draftMessage({
          company: place.name,
          niche,
          city,
          facts: analysis.facts,
          hypothesis: analysis.hypothesis,
        });
        problem = draft.problem;
        solution = draft.solution;
        message = draft.message;
      } catch (err) {
        log(`Ошибка генерации сообщения "${place.name}": ${err.message}`);
      }
    }

    const lead = {
      id: generateId(),
      domain,
      company: place.name || '',
      niche,
      city,
      source: 'claude_web_search',
      contacts: place.phone || '',
      site_summary: siteText ? siteText.slice(0, 500) : '',
      ai_analysis: `Факты: ${analysis.facts.join('; ')} | Гипотеза: ${analysis.hypothesis}`,
      score,
      score_reason: reason,
      data_confidence: siteText ? 'обычная' : 'низкая (сайт не найден или недоступен)',
      problem,
      solution,
      message,
      status: score >= SCORE_THRESHOLD ? 'Готов к проверке' : 'Низкий score',
      first_contact_date: '',
      last_status_update: new Date().toISOString(),
      notes: '',
    };

    try {
      await sheets.appendLead(lead);
    } catch (err) {
      log(`Ошибка записи в таблицу "${place.name}": ${err.message}`);
      continue;
    }

    if (score >= SCORE_THRESHOLD) {
      try {
        await telegram.sendLeadCard(lead);
        qualified++;
      } catch (err) {
        log(`Ошибка отправки карточки в Telegram "${place.name}": ${err.message}`);
      }
    }

    processed++;
  }

  const summary = `✅ Прогон завершён.\nНовых компаний обработано: ${processed}\nКарточек в Telegram (score ≥ ${SCORE_THRESHOLD}): ${qualified}`;
  log(summary.replace(/\n/g, ' | '));
  try {
    await telegram.sendPlainMessage(summary);
  } catch (err) {
    log(`Не удалось отправить итоговое сообщение в Telegram: ${err.message}`);
  }
}

module.exports = { runPipeline, buildLeadKey, generateId };
