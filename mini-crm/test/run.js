// Простые проверки без внешних зависимостей — запускаются: npm test
const assert = require('node:assert');
const { parseNetlifyLead } = require('../src/lead');
const { formatLeadMessage } = require('../src/telegram');

// 1. Разбор типового payload от Netlify Forms
{
  const body = {
    form_name: 'contact',
    data: {
      name: 'Иван Иванов',
      email: 'ivan@example.com',
      phone: '+7 999 000-00-00',
      message: 'Хочу узнать про RAG-бота',
    },
  };
  const lead = parseNetlifyLead(body);
  assert.strictEqual(lead.name, 'Иван Иванов');
  assert.strictEqual(lead.email, 'ivan@example.com');
  assert.strictEqual(lead.phone, '+7 999 000-00-00');
  assert.strictEqual(lead.message, 'Хочу узнать про RAG-бота');
  assert.strictEqual(lead.form_name, 'contact');
  assert.strictEqual(lead.status, 'Новая');
  assert.ok(lead.received_at);
  console.log('OK: разбор обычной заявки');
}

// 2. Поля с заглавной буквы / кириллицей — тоже должны подхватываться
{
  const body = { form_name: 'lending', data: { Имя: 'Мария', Телефон: '89990000000' } };
  const lead = parseNetlifyLead(body);
  assert.strictEqual(lead.name, 'Мария');
  assert.strictEqual(lead.phone, '89990000000');
  console.log('OK: разбор с кириллическими именами полей');
}

// 3. Пустой/битый payload не должен падать с исключением
{
  const lead = parseNetlifyLead({});
  assert.strictEqual(lead.name, '');
  assert.strictEqual(lead.status, 'Новая');
  console.log('OK: пустой payload обрабатывается без ошибок');
}

// 4. Формирование текста уведомления в Telegram
{
  const lead = {
    name: 'Иван Иванов',
    phone: '+7 999 000-00-00',
    email: 'ivan@example.com',
    message: 'Хочу RAG-бота',
    form_name: 'contact',
  };
  const text = formatLeadMessage(lead);
  assert.ok(text.includes('Иван Иванов'));
  assert.ok(text.includes('+7 999 000-00-00'));
  assert.ok(text.includes('Новая заявка с сайта'));
  console.log('OK: формирование текста уведомления');
}

// 5. Пустые поля не должны попадать в текст уведомления как "undefined"
{
  const text = formatLeadMessage({ name: 'Мария' });
  assert.ok(text.includes('Мария'));
  assert.ok(!text.includes('undefined'));
  assert.ok(!text.includes('Телефон:'));
  console.log('OK: пустые поля не попадают в уведомление');
}

// 6. HTML-спецсимволы в сообщении не должны ломать разметку Telegram
{
  const text = formatLeadMessage({ name: 'Тест <script>', message: 'A & B > C' });
  assert.ok(!text.includes('<script>'));
  assert.ok(text.includes('&lt;script&gt;'));
  assert.ok(text.includes('A &amp; B &gt; C'));
  console.log('OK: экранирование HTML-спецсимволов');
}

console.log('\nВсе проверки пройдены.');
