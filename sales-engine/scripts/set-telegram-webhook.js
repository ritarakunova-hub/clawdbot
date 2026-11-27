const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const BASE = process.env.PUBLIC_BASE_URL || '';

function validate() {
  if (!TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is required');
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(SECRET)) throw new Error('TELEGRAM_WEBHOOK_SECRET must use Telegram-supported characters and be 1–256 chars');
  let base;
  try { base = new URL(BASE); } catch { throw new Error('PUBLIC_BASE_URL must be a valid public HTTPS URL'); }
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash ||
      base.pathname !== '/' || base.hostname === 'localhost' || base.hostname.endsWith('.local')) {
    throw new Error('PUBLIC_BASE_URL must be the HTTPS origin of the deployed service');
  }
  return base.origin + '/telegram/webhook';
}

async function setWebhook() {
  const url = validate();
  const response = await fetch('https://api.telegram.org/bot' + TOKEN + '/setWebhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      url,
      secret_token: SECRET,
      allowed_updates: ['callback_query'],
      drop_pending_updates: false
    }),
    signal: AbortSignal.timeout(15000)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.ok !== true) {
    throw new Error('Telegram rejected webhook configuration (HTTP ' + response.status + ')');
  }
  process.stdout.write('Telegram webhook configured. Secret values were not printed.\n');
}

setWebhook().catch(error => {
  process.stderr.write('Webhook setup failed: ' + error.message + '\n');
  process.exitCode = 1;
});
