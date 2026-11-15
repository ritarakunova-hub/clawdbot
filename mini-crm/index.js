const express = require('express');
const { parseNetlifyLead } = require('./src/lead');
const { verifyNetlifySignature } = require('./src/netlify-signature');
const { appendLead, setNotificationStatus } = require('./src/sheets');
const { notifyNewLead } = require('./src/telegram');
const { createSerialQueue } = require('./src/serial-queue');

const app = express();
app.use(express.json({
  limit: '100kb',
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

      if (stored.duplicate && stored.notificationStatus === 'sent') {
        return {
          status: 200,
          body: { ok: true, duplicate: true, notification: 'sent' }
        };
      }

      if (stored.duplicate && stored.notificationStatus === 'sending') {
        // A prior request may have reached Telegram before the process stopped.
        // Do not blindly send a second notification.
        return {
          status: 202,
          body: { ok: true, duplicate: true, notification: 'manual_review_required' }
        };
      }

      await setNotificationStatus(lead.submission_id, 'sending');

      try {
        await notifyNewLead(lead);
      } catch {
        await setNotificationStatus(lead.submission_id, 'failed').catch(() => {});
        const failure = new Error('telegram_notification_failed');
        failure.code = 'telegram_notification_failed';
        throw failure;
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

app.listen(PORT, () => {
  console.log('TAINA mini-CRM запущена, порт ' + PORT);
  if (!NETLIFY_JWS_SECRET) {
    console.error('[mini-crm] NETLIFY_JWS_SECRET не задан: входящий webhook закрыт');
  }
});
