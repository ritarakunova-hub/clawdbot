const express = require('express');
const { parseNetlifyLead } = require('./src/lead');
const { verifyNetlifySignature } = require('./src/netlify-signature');
const { appendLead, setNotificationStatus } = require('./src/sheets');
const { notifyNewLead } = require('./src/telegram');
const { createSerialQueue } = require('./src/serial-queue');
const { decideDuplicateNotification } = require('./src/notification-state');

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(express.json({
  limit: '64kb',
  inflate: false,
  verify: (req, res, buffer) => {
    req.rawBody = Buffer.from(buffer);
  }
}));

const PORT = process.env.PORT || 3000;
const NETLIFY_JWS_SECRET = process.env.NETLIFY_JWS_SECRET || '';
const enqueue = createSerialQueue();

app.get('/health', (req, res) => {
  res.status(200).json({ ok: true });
});

app.post('/webhook/netlify-lead', async (req, res) => {
  if (!NETLIFY_JWS_SECRET) {
    return res.status(503).json({ ok: false, error: 'webhook_not_configured' });
  }

  const signature = req.get('x-webhook-signature') || '';
  if (!verifyNetlifySignature(signature, req.rawBody, NETLIFY_JWS_SECRET)) {
    return res.status(401).json({ ok: false, error: 'invalid_signature' });
  }

  let lead;
  try {
    lead = parseNetlifyLead(req.body);
  } catch (err) {
    return res.status(422).json({
      ok: false,
      error: err.code || 'invalid_submission'
    });
  }

  try {
    const result = await enqueue(async () => {
      const stored = await appendLead(lead);

      if (stored.duplicate) {
        const decision = decideDuplicateNotification(stored.notificationStatus);
        if (decision.action === 'already_sent') {
          return {
            status: 200,
            body: { ok: true, duplicate: true, notification: 'sent' }
          };
        }

        if (decision.action === 'manual_review') {
          // "sending", "failed" and unknown states may represent an ambiguous
          // Telegram outcome. Never retry them automatically.
          return {
            status: 202,
            body: { ok: true, duplicate: true, notification: 'manual_review_required' }
          };
        }
      }

      await setNotificationStatus(lead.submission_id, 'sending');

      try {
        await notifyNewLead(lead);
      } catch {
        // A timeout/error does not prove Telegram did not deliver the message.
        // Leave status as "sending"; retries must go to manual review, never resend blindly.
        console.error('[mini-crm] notification_outcome_uncertain', lead.submission_id);
        return {
          status: 202,
          body: { ok: true, duplicate: false, notification: 'manual_review_required' }
        };
      }

      try {
        await setNotificationStatus(lead.submission_id, 'sent');
      } catch {
        // Telegram has confirmed delivery. Do not return a retryable error,
        // otherwise Netlify could trigger a duplicate Telegram message.
        console.error('[mini-crm] notification_status_uncertain', lead.submission_id);
        return {
          status: 200,
          body: { ok: true, duplicate: stored.duplicate, notification: 'sent_status_unconfirmed' }
        };
      }

      return {
        status: 200,
        body: { ok: true, duplicate: stored.duplicate, notification: 'sent' }
      };
    });

    return res.status(result.status).json(result.body);
  } catch (err) {
    // Avoid logging request bodies, names, phone numbers, emails or messages.
    const code = err && err.code === 'telegram_notification_failed'
      ? 'telegram_notification_failed'
      : 'storage_or_processing_failed';
    console.error('[mini-crm] processing_failed', {
      submission_id: lead.submission_id,
      code
    });
    return res.status(503).json({ ok: false, error: code });
  }
});

// Do not expose Express stack traces or request payloads on malformed/oversized input.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const tooLarge = err && (err.type === 'entity.too.large' || err.status === 413);
  const unsupportedEncoding = err && (err.status === 415 || err.type === 'encoding.unsupported');
  const status = tooLarge ? 413 : (unsupportedEncoding ? 415 : 400);
  return res.status(status).json({
    ok: false,
    error: tooLarge ? 'payload_too_large' :
      (unsupportedEncoding ? 'unsupported_content_encoding' : 'invalid_request')
  });
});

app.listen(PORT, () => {
  console.log('TAINA mini-CRM запущена, порт ' + PORT);
  if (!NETLIFY_JWS_SECRET) {
    console.error('[mini-crm] NETLIFY_JWS_SECRET не задан: входящий webhook закрыт');
  }
});
