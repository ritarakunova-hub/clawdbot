// Простые проверки без обращения к реальным Outscraper/Claude/Google/Telegram —
// запускаются: npm test
const assert = require('node:assert');
const { normalizeDomain } = require('../src/outscraper');
const { computeScore, digitalPresenceCriterion } = require('../src/scoring');
const { formatLeadCard } = require('../src/telegram');
const { buildLeadKey } = require('../src/pipeline');
const { fetchSiteText } = require('../src/siteFetch');
const { parseAnalysis, daysSince } = require('../src/followup');

// 1. normalizeDomain — убирает протокол и www, приводит к нижнему регистру
{
  assert.strictEqual(normalizeDomain('https://www.Example.com/path'), 'example.com');
  assert.strictEqual(normalizeDomain('example.ru'), 'example.ru');
  assert.strictEqual(normalizeDomain(''), '');
  assert.strictEqual(normalizeDomain(null), '');
  console.log('OK: normalizeDomain');
}

// 2. computeScore — детерминированная формула, а не выдумка LLM
{
  const strongCriteria = {
    business_fit: { present: true, confidence: 'high', evidence: 'сеть медцентров' },
    repetitive_queries_signal: { present: true, confidence: 'high', evidence: 'много FAQ' },
    multi_location_or_scale: { present: true, confidence: 'high', evidence: '5 филиалов' },
    clear_automation_solution: { present: true, confidence: 'high', evidence: 'ассистент для FAQ' },
    digital_presence_quality: { present: true, confidence: 'high', evidence: 'сайт информативный' },
  };
  const { score, reason } = computeScore(strongCriteria);
  assert.strictEqual(score, 100);
  assert.ok(reason.includes('медцентров'));
  console.log('OK: computeScore — сильный лид даёт 100');
}

{
  const weakCriteria = {
    business_fit: { present: false, confidence: 'low', evidence: 'ниша не похожа на целевую' },
    repetitive_queries_signal: { present: false, confidence: 'low', evidence: 'нет сигналов' },
    multi_location_or_scale: { present: false, confidence: 'low', evidence: 'одна точка' },
    clear_automation_solution: { present: false, confidence: 'low', evidence: 'непонятно что предложить' },
    digital_presence_quality: { present: false, confidence: 'low', evidence: 'сайта нет' },
  };
  const { score, reason } = computeScore(weakCriteria);
  assert.strictEqual(score, 0);
  assert.ok(reason.includes('Недостаточно'));
  console.log('OK: computeScore — слабый лид даёт 0');
}

{
  // Низкая уверенность должна снижать вклад критерия, а не занулять его
  const mediumCriteria = {
    business_fit: { present: true, confidence: 'medium', evidence: 'похоже на подходящую нишу' },
  };
  const { score } = computeScore(mediumCriteria);
  assert.strictEqual(score, Math.round(25 * 0.7)); // 18
  console.log('OK: computeScore — medium confidence уменьшает вклад критерия');
}

// 3. digitalPresenceCriterion
{
  assert.strictEqual(digitalPresenceCriterion(null).present, false);
  assert.strictEqual(digitalPresenceCriterion('короткий').confidence, 'medium');
  assert.strictEqual(digitalPresenceCriterion('x'.repeat(1000)).confidence, 'high');
  console.log('OK: digitalPresenceCriterion');
}

// 4. formatLeadCard — карточка содержит ключевые поля и экранирует HTML
{
  const lead = {
    company: 'Клиника <Здоровье>',
    niche: 'медицина',
    city: 'Москва',
    domain: 'clinic.ru',
    contacts: '+7 999 000-00-00',
    score: 85,
    score_reason: 'сеть клиник, много FAQ',
    problem: 'администраторы тратят время на типовые вопросы',
    solution: 'AI-ассистент на базе RAG',
    message: 'Увидела, что у вас сеть клиник...',
  };
  const card = formatLeadCard(lead);
  assert.ok(card.includes('85/100'));
  assert.ok(card.includes('clinic.ru'));
  assert.ok(card.includes('&lt;Здоровье&gt;')); // экранировано, не сломает HTML-разметку Telegram
  assert.ok(!card.includes('<Здоровье>'));
  console.log('OK: formatLeadCard');
}

// 5. buildLeadKey — домен приоритетнее, иначе название+город
{
  assert.strictEqual(buildLeadKey('example.ru', 'Компания', 'Москва'), 'example.ru');
  assert.strictEqual(buildLeadKey('', 'Компания', 'Москва'), 'компания|москва');
  console.log('OK: buildLeadKey');
}

// 6. parseAnalysis — разбирает обратно строку "Факты: ... | Гипотеза: ..."
{
  const parsed = parseAnalysis('Факты: сеть из 5 клиник; много отзывов | Гипотеза: высокая нагрузка на администраторов');
  assert.deepStrictEqual(parsed.facts, ['сеть из 5 клиник', 'много отзывов']);
  assert.strictEqual(parsed.hypothesis, 'высокая нагрузка на администраторов');
  console.log('OK: parseAnalysis');
}
{
  // Битая/пустая строка не должна ронять код
  const parsed = parseAnalysis('');
  assert.ok(Array.isArray(parsed.facts));
  console.log('OK: parseAnalysis — пустая строка не падает');
}

// 7. daysSince — считает дни корректно
{
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  assert.ok(Math.abs(daysSince(threeDaysAgo) - 3) < 0.01);
  assert.strictEqual(daysSince(''), Infinity);
  console.log('OK: daysSince');
}

// 8. formatLeadCard — follow-up карточка показывает отдельный заголовок
{
  const followUpLead = {
    company: 'Клиника Здоровье',
    niche: 'медицина',
    city: 'Москва',
    domain: 'clinic.ru',
    contacts: '+7 999 000-00-00',
    follow_up_count: 1,
    score_reason: 'Прошло 3 дн. без ответа',
    problem: 'p',
    solution: 's',
    message: 'follow-up текст',
  };
  const card = formatLeadCard(followUpLead);
  assert.ok(card.includes('Follow-up №1'));
  assert.ok(!card.includes('Новый лид'));
  console.log('OK: formatLeadCard — follow-up заголовок');
}

// 9. fetchSiteText — парсинг HTML в текст (сеть подменяем)
{
  (async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      headers: { get: () => 'text/html; charset=utf-8' },
      text: async () => '<html><head><style>.a{}</style></head><body><h1>О нас</h1><p>Мы делаем классные вещи &amp; помогаем клиентам.</p><script>evil()</script></body></html>',
    });

    const text = await fetchSiteText('example.com');
    assert.ok(text.includes('О нас'));
    assert.ok(text.includes('Мы делаем классные вещи & помогаем клиентам'));
    assert.ok(!text.includes('evil()'));
    assert.ok(!text.includes('<h1>'));

    global.fetch = originalFetch;
    console.log('OK: fetchSiteText — очистка HTML');
  })().then(() => {
    console.log('\nВсе проверки пройдены.');
  }).catch((err) => {
    console.error('ОШИБКА в тестах:', err);
    process.exit(1);
  });
}
