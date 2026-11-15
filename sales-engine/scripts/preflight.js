const REQUIRED = [
  'ANTHROPIC_API_KEY',
  'GOOGLE_SHEET_ID',
  'GOOGLE_SERVICE_ACCOUNT_KEY_BASE64',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'TELEGRAM_WEBHOOK_SECRET',
  'TELEGRAM_ADMIN_USER_ID',
  'APP_USERNAME',
  'APP_PASSWORD'
];

function runPreflight(env = process.env) {
  const errors = [];
  for (const name of REQUIRED) {
    if (typeof env[name] !== 'string' || !env[name].trim()) errors.push(name + ' is required');
  }
  if (env.TELEGRAM_ADMIN_USER_ID &&
      (!/^\d{1,18}$/.test(env.TELEGRAM_ADMIN_USER_ID) ||
       !Number.isSafeInteger(Number(env.TELEGRAM_ADMIN_USER_ID)) ||
       Number(env.TELEGRAM_ADMIN_USER_ID) <= 0)) {
    errors.push('TELEGRAM_ADMIN_USER_ID must be a positive numeric Telegram user ID');
  }
  if (env.TELEGRAM_WEBHOOK_SECRET &&
      (!/^[A-Za-z0-9_-]{32,256}$/.test(env.TELEGRAM_WEBHOOK_SECRET) ||
       env.TELEGRAM_WEBHOOK_SECRET === env.APP_PASSWORD)) {
    errors.push('TELEGRAM_WEBHOOK_SECRET must be 32–256 chars and differ from APP_PASSWORD');
  }
  if (env.APP_PASSWORD && env.APP_PASSWORD.length < 16) {
    errors.push('APP_PASSWORD must contain at least 16 characters');
  }
  if (env.PUBLIC_BASE_URL) {
    try {
      const url = new URL(env.PUBLIC_BASE_URL);
      if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash ||
          url.username || url.password) errors.push('PUBLIC_BASE_URL must be an HTTPS origin');
    } catch {
      errors.push('PUBLIC_BASE_URL must be a valid HTTPS origin');
    }
  }
  if (!env.PUBLIC_BASE_URL) errors.push('PUBLIC_BASE_URL is required for webhook setup');
  if (errors.length) return { ok: false, errors };
  return { ok: true, errors: [] };
}

if (require.main === module) {
  const result = runPreflight();
  if (result.ok) {
    process.stdout.write('Preflight OK. Required settings are present; values were not printed.\n');
  } else {
    process.stderr.write('Preflight failed:\n' + result.errors.map(item => '- ' + item).join('\n') + '\n');
    process.exitCode = 1;
  }
}

module.exports = { runPreflight };
