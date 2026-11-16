const { setTelegramWebhook } = require('../src/webhook-setup');

async function main() {
  const result = await setTelegramWebhook({
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL
  });

  // The result deliberately contains only the public webhook URL, never secrets.
  console.log('Telegram webhook зарегистрирован: ' + result.webhookUrl);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[webhook-setup] ' + err.message);
    process.exitCode = 1;
  });
}

module.exports = { main };
