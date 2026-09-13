/**
 * Scoring — намеренно НЕ отдаём Claude "поставь score от 0 до 100".
 * Модели плохо и невоспроизводимо оценивают одним числом.
 * Вместо этого Claude отвечает по каждому критерию структурированно
 * (есть сигнал / нет / уверенность), а итоговая цифра считается
 * прозрачной формулой здесь — её легко объяснить и легко пересчитать
 * при смене весов.
 */

const WEIGHTS = {
  business_fit: 25,
  repetitive_queries_signal: 25,
  multi_location_or_scale: 20,
  clear_automation_solution: 20,
  digital_presence_quality: 10,
};

const LABELS = {
  business_fit: 'Ниша подходит TAINA',
  repetitive_queries_signal: 'Признаки повторяющихся обращений/процессов',
  multi_location_or_scale: 'Масштаб (сеть/поток клиентов)',
  clear_automation_solution: 'Понятное решение для автоматизации',
  digital_presence_quality: 'Качество данных для анализа',
};

const CONFIDENCE_MULTIPLIER = { high: 1, medium: 0.7, low: 0.4 };

/**
 * criteria — объект вида { business_fit: {present, confidence, evidence}, ... }
 * (4 критерия приходят от Claude, digital_presence_quality считается кодом
 * в pipeline.js по факту наличия текста сайта).
 */
function computeScore(criteria) {
  let total = 0;
  const reasons = [];

  for (const [key, weight] of Object.entries(WEIGHTS)) {
    const c = criteria[key];
    if (!c) continue;

    const multiplier = c.present ? CONFIDENCE_MULTIPLIER[c.confidence] ?? 0.5 : 0;
    const contribution = Math.round(weight * multiplier);
    total += contribution;

    if (c.present) {
      reasons.push(`${LABELS[key]} (+${contribution}): ${c.evidence}`);
    }
  }

  const score = Math.max(0, Math.min(100, total));
  const reason = reasons.length
    ? reasons.join('; ')
    : 'Недостаточно сигналов, чтобы поставить высокую оценку';

  return { score, reason };
}

/**
 * Критерий "качество данных" не спрашиваем у Claude — считаем сами
 * по факту, удалось ли скачать и разобрать сайт компании.
 */
function digitalPresenceCriterion(siteText) {
  if (!siteText) {
    return { present: false, confidence: 'low', evidence: 'сайт не найден или недоступен' };
  }
  if (siteText.length < 300) {
    return { present: true, confidence: 'medium', evidence: 'сайт есть, но мало текста для анализа' };
  }
  return { present: true, confidence: 'high', evidence: 'сайт доступен, достаточно текста для анализа' };
}

module.exports = { computeScore, digitalPresenceCriterion, WEIGHTS, LABELS };
