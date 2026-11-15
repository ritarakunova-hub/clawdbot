// Unit tests use synthetic data only; no real Telegram/Google credentials are required.
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { parseNetlifyLead, hasConsent } = require('../src/lead');
const { formatLeadMessage } = require('../src/telegram');
const { verifyNetlifySignature } = require('../src/netlify-signature');
const { findSubmissionRow } = require('../src/sheets');
const { createSerialQueue } = require('../src/serial-queue');

function makeJws(body, secret, overrides = {}) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const claims = Buffer.from(JSON.stringify({
    iss: 'netlify',
    sha256: crypto.createHash('sha256').update(body).digest('hex'),
    ...overrides
  })).toString('base64url');
  const input = header + '.' + claims;
  const signature = crypto.createHmac('sha256', secret).update(input).digest('base64url');
  return input + '.' + signature;
}

// 1. Valid Netlify JWS verifies against the exact raw JSON payload.
{
  const secret = 'netlify-jws-secret-for-synthetic-tests-only';
  const raw = Buffer.from(JSON.stringify({
    payload: {
      id: 'submission-001',
      form_name: 'taina-diagnostic',
      created_at: '2026-11-15T10:00:00.000Z',
      data: { name: 'Тест', email: 'test@example.com', consent: 'yes' }
    }
  }));
  const token = makeJws(raw, secret);
  assert.strictEqual(verifyNetlifySignature(token, raw, secret), true);
  assert.strictEqual(verifyNetlifySignature(token, raw, 'wrong-secret'), false);
  assert.strictEqual(verifyNetlifySignature(token, Buffer.from(raw.toString() + ' '), secret), false);
  assert.strictEqual(verifyNetlifySignature('not-a-jws', raw, secret), false);
  assert.strictEqual(verifyNetlifySignature('', raw, secret), false);
  console.log('OK: Netlify JWS signature and raw body verification');
}

// 2. Parser accepts the documented nested Netlify Forms payload.
{
  const lead = parseNetlifyLead({
    payload: {
      id: 'sub-123',
      form_name: 'taina-diagnostic',
      created_at: '2026-11-15T10:00:00.000Z',
      data: {
        name: 'Ольга Смирнова',
        email: 'olga@example.com',
        message: 'Нужна диагностика обработки заявок',
        consent: 'yes'
      }
    }
  });
  assert.strictEqual(lead.submission_id, 'sub-123');
  assert.strictEqual(lead.name, 'Ольга Смирнова');
  assert.strictEqual(lead.email, 'olga@example.com');
  assert.strictEqual(lead.form_name, 'taina-diagnostic');
  assert.strictEqual(lead.consent_status, 'yes');
  assert.strictEqual(lead.status, 'Новая');
  assert.strictEqual(lead.received_at, '2026-11-15T10:00:00.000Z');
  console.log('OK: parse nested Netlify lead');
}

// 3. Single contact field may contain either an email or a phone/messenger.
{
  const email = parseNetlifyLead({
    payload: { id: 'sub-124', form_name: 'contact', data: { contact: 'person@example.com', consent: 'on' } }
  });
  assert.strictEqual(email.email, 'person@example.com');
  assert.strictEqual(email.phone, '');

  const phone = parseNetlifyLead({
    payload: { id: 'sub-125', form_name: 'contact', data: { Контакт: '+7 999 000-11-22', согласие: 'да' } }
  });
  assert.strictEqual(phone.phone, '+7 999 000-11-22');
  assert.strictEqual(phone.email, '');
  assert.strictEqual(hasConsent({ consent: 'true' }), true);
  assert.strictEqual(hasConsent({ consent: 'no' }), false);
  console.log('OK: contact and consent field handling');
}

// 4. Invalid submissions are rejected instead of becoming empty CRM rows.
{
  assert.throws(() => parseNetlifyLead({ payload: { form_name: 'contact', data: { email: 'a@b.com', consent: 'yes' } } }),
    (err) => err.code === 'missing_submission_id');
  assert.throws(() => parseNetlifyLead({ payload: { id: 'sub-1', form_name: 'contact', data: { email: 'a@b.com' } } }),
    (err) => err.code === 'consent_required');
  assert.throws(() => parseNetlifyLead({ payload: { id: 'sub-2', form_name: 'contact', data: { email: 'not-an-email', consent: 'yes' } } }),
    (err) => err.code === 'invalid_email');
  assert.throws(() => parseNetlifyLead({ payload: { id: 'sub-3', form_name: 'contact', data: { name: 'No contact', consent: 'yes' } } }),
    (err) => err.code === 'contact_required');
  assert.throws(() => parseNetlifyLead({ payload: { id: 'sub-4', form_name: 'contact', created_at: 'not-a-date', data: { email: 'a@b.com', consent: 'yes' } } }),
    (err) => err.code === 'invalid_created_at');
  assert.throws(() => parseNetlifyLead({ payload: { id: 'sub-5', form_name: 'contact', data: { email: 'a@b.com', message: 'x'.repeat(2001), consent: 'yes' } } }),
    (err) => err.code === 'field_too_long');
  console.log('OK: invalid submissions rejected');
}

// 5. Telegram notification safely escapes markup and bounds free-text length.
{
  const message = formatLeadMessage({
    name: 'Тест <script>',
    email: 'test@example.com',
    message: 'A & B > C',
    form_name: 'contact',
    submission_id: 'sub-456'
  });
  assert.ok(message.includes('&lt;script&gt;'));
  assert.ok(message.includes('A &amp; B &gt; C'));
  assert.ok(message.includes('ID заявки'));
  assert.ok(!message.includes('<script>'));

  const longMessage = formatLeadMessage({ message: 'x'.repeat(800) });
  assert.ok(longMessage.length < 600);
  assert.ok(!longMessage.includes('undefined'));
  console.log('OK: Telegram notification formatting');
}

// 6. Existing submission ID maps to the expected row and notification state.
{
  const rows = [
    ['sub-1', 'yes', 'sent'],
    ['sub-2', 'yes', 'failed']
  ];
  assert.deepStrictEqual(findSubmissionRow(rows, 'sub-1'), {
    rowNumber: 2,
    consentStatus: 'yes',
    notificationStatus: 'sent'
  });
  assert.deepStrictEqual(findSubmissionRow(rows, 'sub-2'), {
    rowNumber: 3,
    consentStatus: 'yes',
    notificationStatus: 'failed'
  });
  assert.strictEqual(findSubmissionRow(rows, 'missing'), null);
  console.log('OK: CRM submission deduplication lookup');
}

// 7. In-process queue serializes concurrent requests and continues after a failed task.
async function testSerialQueue() {
  const enqueue = createSerialQueue();
  const order = [];
  await Promise.all([
    enqueue(async () => { order.push('first:start'); await new Promise(resolve => setTimeout(resolve, 10)); order.push('first:end'); }),
    enqueue(async () => { order.push('second:start'); order.push('second:end'); }),
    enqueue(async () => { order.push('third:start'); throw new Error('synthetic failure'); }).catch(() => {}),
    enqueue(async () => { order.push('fourth:start'); order.push('fourth:end'); })
  ]);
  assert.deepStrictEqual(order, [
    'first:start', 'first:end',
    'second:start', 'second:end',
    'third:start',
    'fourth:start', 'fourth:end'
  ]);
  console.log('OK: serialized intake queue');
}

async function run() {
  await testSerialQueue();
  // Security regression checks: no legacy query-string secret or raw payload logging.
  const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  assert.ok(indexSource.includes("x-webhook-signature"));
  assert.ok(indexSource.includes("NETLIFY_JWS_SECRET"));
  assert.ok(!indexSource.includes("req.query.token"));
  assert.ok(!indexSource.includes("body =', req.body"));
  console.log('OK: webhook security regression checks');
  console.log('\nAll mini-CRM checks passed.');
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
