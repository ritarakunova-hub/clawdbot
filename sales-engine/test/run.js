// Простые проверки без обращения к реальным Claude/Google/Telegram —
// запускаются: npm test
const assert = require('node:assert');
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
const { normalizeDomain, extractJsonArray } = require('../src/webLeadSearch');
const { computeScore, digitalPresenceCriterion } = require('../src/scoring');
const { formatLeadCard } = require('../src/telegram');
const { buildLeadKey } = require('../src/pipeline');
const { fetchSiteText, isPublicIPv4, parsePublicHttpUrl } = require('../src/siteFetch');
const { safeEqual, verifyBasicAuth, verifyCsrf, verifyTelegramCallback, escapeHtml } = require('../src/security');
const { deliverLeadCard, STATUS_READY, STATUS_NEEDS_REVIEW, STATUS_DISPATCHING, canRetryLeadNotification } = require('../src/notification');
const { runPreflight } = require('../scripts/preflight');
const fs = require('node:fs');
const path = require('node:path');
const { parseAnalysis, daysSince } = require('../src/followup');
const { getLeadActionTransition, STATUS_APPROVED, STATUS_SENT } = require('../src/lead-status');

// 1. normalizeDomain — убирает протокол и www, приводит к нижнему регистру
{
  assert.strictEqual(normalizeDomain('https://www.Example.com/path'), 'example.com');
  assert.strictEqual(normalizeDomain('example.ru'), 'example.ru');
  assert.strictEqual(normalizeDomain(''), '');
  assert.strictEqual(normalizeDomain(null), '');
  console.log('OK: normalizeDomain');

// 1a. Authentication and request authorization fail closed.
{
  assert.strictEqual(safeEqual('secret', 'secret'), true);
  assert.strictEqual(safeEqual('secret', 'wrong'), false);
  assert.strictEqual(safeEqual('', ''), false);
  const valid = 'Basic ' + Buffer.from('operator:correct-horse').toString('base64');
  assert.strictEqual(verifyBasicAuth(valid, 'operator', 'correct-horse'), true);
  assert.strictEqual(verifyBasicAuth(valid, 'operator', 'wrong'), false);
  assert.strictEqual(verifyBasicAuth(valid, '', 'correct-horse'), false);
  assert.strictEqual(verifyBasicAuth('Basic !!!', 'operator', 'correct-horse'), false);
  assert.strictEqual(verifyTelegramCallback({
    from: { id: 12345 },
    message: { message_id: 7, chat: { id: 555 } }
  }, '12345', '555'), true);
  assert.strictEqual(verifyTelegramCallback({
    from: { id: 12345 },
    message: { message_id: 7, chat: { id: 555 } }
  }, '12345', '555', '7'), true);
  assert.strictEqual(verifyTelegramCallback({
    from: { id: 12345 },
    message: { message_id: 8, chat: { id: 555 } }
  }, '12345', '555', '7'), false);
  assert.strictEqual(canRetryLeadNotification({ status: STATUS_NEEDS_REVIEW }), true);
  assert.strictEqual(canRetryLeadNotification({ status: STATUS_DISPATCHING }), true);
  assert.strictEqual(canRetryLeadNotification({ status: STATUS_READY, telegram_message_id: '' }), true);
  assert.strictEqual(canRetryLeadNotification({ status: STATUS_READY, telegram_message_id: '123' }), false);
  assert.strictEqual(canRetryLeadNotification({ status: 'Отправлено' }), false);
  assert.strictEqual(canRetryLeadNotification(null), false);
  assert.strictEqual(verifyTelegramCallback({
    from: { id: 9 },
    message: { message_id: 7, chat: { id: 555 } }
  }, '12345', '555'), false);
  assert.strictEqual(verifyTelegramCallback(null, '12345', '555'), false);
  assert.strictEqual(escapeHtml('<x a="b">'), '&lt;x a=&quot;b&quot;&gt;');
  const csrfReq = {
    body: { _csrf: 'token-123' },
    headers: { cookie: '__Host-taina-csrf=token-123', host: 'example.com', origin: 'https://example.com', 'sec-fetch-site': 'same-origin' }
  };
  assert.strictEqual(verifyCsrf(csrfReq, 'example.com'), true);
  assert.strictEqual(verifyCsrf({ ...csrfReq, headers: { ...csrfReq.headers, origin: 'https://evil.example' } }, 'example.com'), false);
  assert.strictEqual(verifyCsrf({ ...csrfReq, body: { _csrf: 'wrong' } }, 'example.com'), false);
  console.log('OK: authentication, Telegram authorization and CSRF');

  const validEnv = {
    ANTHROPIC_API_KEY: 'test',
    GOOGLE_SHEET_ID: 'sheet-id',
    GOOGLE_SERVICE_ACCOUNT_KEY_BASE64: 'e30=',
    TELEGRAM_BOT_TOKEN: '123:token',
    TELEGRAM_CHAT_ID: '12345',
    TELEGRAM_WEBHOOK_SECRET: 'x'.repeat(40),
    TELEGRAM_ADMIN_USER_ID: '12345',
    APP_USERNAME: 'operator',
    APP_PASSWORD: 'a-very-long-password',
    PUBLIC_BASE_URL: 'https://sales.example.com/'
  };
  assert.deepStrictEqual(runPreflight(validEnv), { ok: true, errors: [] });
  assert.ok(runPreflight({ ...validEnv, TELEGRAM_ADMIN_USER_ID: '0' }).errors.some(x => x.includes('TELEGRAM_ADMIN_USER_ID')));
  assert.ok(runPreflight({ ...validEnv, TELEGRAM_WEBHOOK_SECRET: 'short' }).errors.some(x => x.includes('TELEGRAM_WEBHOOK_SECRET')));
  assert.ok(runPreflight({ ...validEnv, APP_PASSWORD: 'tiny' }).errors.some(x => x.includes('APP_PASSWORD')));
  assert.ok(runPreflight({ ...validEnv, PUBLIC_BASE_URL: 'http://sales.example.com/' }).errors.some(x => x.includes('PUBLIC_BASE_URL')));
  const sheetsSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'sheets.js'), 'utf8');
  assert.ok(sheetsSource.includes("valueInputOption: 'RAW'"));
  assert.ok(!sheetsSource.includes("valueInputOption: 'USER_ENTERED'"));
  console.log('OK: deployment preflight and spreadsheet formula-injection regression checks');
}
}


 // A human approval is not proof that an outbound message was sent.
{
  assert.deepStrictEqual(getLeadActionTransition('approve', STATUS_READY), {
    nextStatus: STATUS_APPROVED,
    callbackText: 'Одобрено к отправке',
  });
  assert.deepStrictEqual(getLeadActionTransition('sent', STATUS_APPROVED), {
    nextStatus: STATUS_SENT,
    callbackText: 'Отправлено — follow-up отсчёт начат',
  });
  assert.strictEqual(getLeadActionTransition('sent', STATUS_READY), null);
  assert.strictEqual(getLeadActionTransition('approve', STATUS_APPROVED), null);
  assert.strictEqual(getLeadActionTransition('sent', STATUS_SENT), null);
  assert.strictEqual(getLeadActionTransition('reject', STATUS_APPROVED), null);
  console.log('OK: follow-up starts only after explicit confirmation that the message was sent');
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
  assert.ok(!Number.isFinite(daysSince('not-a-date')));
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

// 9. webLeadSearch.extractJsonArray — вытаскивает JSON-массив из текста
// ответа Claude (текст до/после блока, markdown-разметка не мешают)
{
  const text = 'Нашла несколько компаний через поиск.\n```json\n[{"name": "Клиника Здоровье", "site": "https://health-clinic.ru", "phone": "+7 999 000-00-00"}, {"name": "Без сайта", "site": "", "phone": ""}]\n```';
  const result = extractJsonArray(text);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].name, 'Клиника Здоровье');
  assert.strictEqual(result[0].site, 'https://health-clinic.ru');
  assert.strictEqual(result[1].site, '');
  console.log('OK: extractJsonArray — извлечение JSON из окружающего текста');
}
{
  // Без JSON-блока и без валидного JSON — не должно падать, просто []
  assert.deepStrictEqual(extractJsonArray('Ничего подходящего не нашла.'), []);
  assert.deepStrictEqual(extractJsonArray('```json\n{ битый json\n```'), []);
  console.log('OK: extractJsonArray — отсутствие/битый JSON не падает');
}

// 10. fetchSiteText — парсинг HTML в текст (сеть подменяем)
{
  (async () => {
    const text = await fetchSiteText('example.com', {
      lookup: async () => [{ address: '93.184.216.34', family: 4 }],
      request: async () => ({
        body: '<html><head><style>.a{}</style></head><body><h1>О нас</h1><p>Мы делаем классные вещи &amp; помогаем клиентам.</p><script>evil()</script></body></html>'
      })
    });
    assert.ok(text.includes('О нас'));
    assert.ok(text.includes('Мы делаем классные вещи & помогаем клиентам'));
    assert.ok(!text.includes('evil()'));
    assert.ok(!text.includes('<h1>'));

    assert.strictEqual(parsePublicHttpUrl('http://127.0.0.1'), null);
    assert.strictEqual(parsePublicHttpUrl('http://169.254.169.254/latest/meta-data'), null);
    assert.strictEqual(parsePublicHttpUrl('http://localhost'), null);
    assert.strictEqual(parsePublicHttpUrl('file:///etc/passwd'), null);
    assert.strictEqual(parsePublicHttpUrl('https://user:pass@example.com'), null);
    assert.strictEqual(parsePublicHttpUrl('https://example.com:8443'), null);
    assert.strictEqual(isPublicIPv4('93.184.216.34'), true);
    assert.strictEqual(isPublicIPv4('10.0.0.1'), false);
    assert.strictEqual(isPublicIPv4('169.254.169.254'), false);

    let requestCount = 0;
    const blocked = await fetchSiteText('https://example.com', {
      lookup: async () => [{ address: '127.0.0.1', family: 4 }],
      request: async () => { requestCount++; return { body: '' }; }
    });
    assert.strictEqual(blocked, null);
    assert.strictEqual(requestCount, 0);

    let literalRedirectDnsCount = 0;
    const literalRedirectBlocked = await fetchSiteText('https://example.com', {
      lookup: async () => {
        literalRedirectDnsCount++;
        return [{ address: '93.184.216.34', family: 4 }];
      },
      request: async () => ({ redirect: 'http://127.0.0.1/admin' })
    });
    assert.strictEqual(literalRedirectBlocked, null);
    // Literal loopback IPs are rejected by URL validation before a second DNS lookup.
    assert.strictEqual(literalRedirectDnsCount, 1);

    let redirectDnsCount = 0;
    let redirectRequestCount = 0;
    const dnsRebindingRedirect = await fetchSiteText('https://example.com', {
      lookup: async () => {
        redirectDnsCount++;
        return [{ address: redirectDnsCount === 1 ? '93.184.216.34' : '10.0.0.2', family: 4 }];
      },
      request: async () => {
        redirectRequestCount++;
        return { redirect: 'https://example.com/admin' };
      }
    });
    assert.strictEqual(dnsRebindingRedirect, null);
    // The hostname is resolved again after redirect; its private second address is blocked.
    assert.strictEqual(redirectDnsCount, 2);
    assert.strictEqual(redirectRequestCount, 1);
    console.log('OK: fetchSiteText — очистка HTML и повторная проверка DNS при redirect');

    // Telegram cards become actionable only after their exact message_id is persisted.
    {
      const events = [];
      const row = { status: 'Исходный статус', telegram_message_id: 'old-id' };
      const fakeSheets = {
        updateFields: async (id, fields) => {
          events.push(`sheet:${fields.status || ''}:${fields.telegram_message_id === undefined ? '' : fields.telegram_message_id}`);
          Object.assign(row, fields);
          return true;
        },
      };
      const fakeTelegram = {
        sendLeadCard: async () => { events.push('send-card'); return 77; },
        attachLeadKeyboard: async (messageId, leadId) => {
          assert.strictEqual(row.telegram_message_id, '77');
          assert.strictEqual(row.status, STATUS_READY);
          events.push(`attach:${messageId}:${leadId}`);
        },
      };
      const result = await deliverLeadCard({ id: 'lead-1' }, { sheets: fakeSheets, telegram: fakeTelegram });
      assert.deepStrictEqual(result, { ok: true, messageId: 77 });
      assert.strictEqual(row.status, STATUS_READY);
      assert.deepStrictEqual(events, [
        'sheet:Уведомление готовится:',
        'send-card',
        'sheet:Готов к проверке:77',
        'attach:77:lead-1',
      ]);
      console.log('OK: Telegram delivery persists exact message_id before enabling approval');
    }
    {
      const row = {};
      const fakeSheets = {
        updateFields: async (id, fields) => { Object.assign(row, fields); return true; },
      };
      const fakeTelegram = {
        sendLeadCard: async () => 88,
        attachLeadKeyboard: async () => { throw new Error('ambiguous_network_failure'); },
      };
      const result = await deliverLeadCard({ id: 'lead-2' }, { sheets: fakeSheets, telegram: fakeTelegram });
      assert.deepStrictEqual(result, { ok: false, stage: 'keyboard' });
      assert.strictEqual(row.status, STATUS_NEEDS_REVIEW);
      assert.strictEqual(row.telegram_message_id, '88');
      console.log('OK: ambiguous Telegram keyboard result fails closed for manual review');
    }
    {
      const row = {};
      const fakeSheets = {
        updateFields: async (id, fields) => { Object.assign(row, fields); return true; },
      };
      const fakeTelegram = {
        sendLeadCard: async () => { throw new Error('timeout'); },
        attachLeadKeyboard: async () => { throw new Error('must_not_be_called'); },
      };
      const result = await deliverLeadCard({ id: 'lead-3' }, { sheets: fakeSheets, telegram: fakeTelegram });
      assert.deepStrictEqual(result, { ok: false, stage: 'send' });
      assert.strictEqual(row.status, STATUS_NEEDS_REVIEW);
      assert.strictEqual(row.telegram_message_id, '');
      console.log('OK: ambiguous Telegram send is not automatically retried');
    }
  })().then(() => {
    console.log('\nВсе проверки пройдены.');
  }).catch((err) => {
    console.error('ОШИБКА в тестах:', err);
    process.exit(1);
  });
}
