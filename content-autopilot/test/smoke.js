const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const appDir = path.resolve(__dirname, '..');
const port = 30000 + (process.pid % 20000);
const pendingFile = path.join(os.tmpdir(), 'taina-smoke-pending-' + process.pid + '.json');
const baseUrl = 'http://127.0.0.1:' + port;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(child) {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error('Application exited before becoming healthy. Exit code: ' + child.exitCode);
    }
    try {
      const response = await fetch(baseUrl + '/health');
      if (response.ok) return response;
      lastError = new Error('Health endpoint returned HTTP ' + response.status);
    } catch (err) {
      lastError = err;
    }
    await delay(100);
  }
  throw lastError || new Error('Application did not become healthy in time');
}

async function stopChild(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    delay(2000),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

async function main() {
  const child = spawn(process.execPath, ['index.js'], {
    cwd: appDir,
    env: {
      ...process.env,
      PORT: String(port),
      TIMEZONE: 'Europe/Moscow',
      CRON_SCHEDULE: '0 0 1 1 *',
      INTERNAL_API_SECRET: 'test-internal-secret',
      TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
      TELEGRAM_CHAT_ID: '123456789',
      TELEGRAM_BOT_TOKEN: 'test-telegram-token',
      PENDING_FILE: pendingFile,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });

  try {
    const healthResponse = await waitForServer(child);
    const health = await healthResponse.json();
    assert.deepEqual(health, {
      ok: true,
      workflow: 'smmplanner-handoff',
      directPublishing: false,
    });
    console.log('OK: application starts in SMMplanner handoff mode');

    const readyResponse = await fetch(baseUrl + '/ready');
    assert.equal(readyResponse.status, 200);
    const readiness = await readyResponse.json();
    assert.equal(readiness.publisher, 'SMMplanner');
    assert.equal(readiness.directPublishing, false);
    assert.equal(readiness.storageWritable, true);
    assert.ok(!JSON.stringify(readiness).includes('test-telegram-token'));
    console.log('OK: /ready confirms SMMplanner handoff configuration without exposing secrets');

    const manualResponse = await fetch(baseUrl + '/check/now', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong-secret' },
    });
    assert.equal(manualResponse.status, 401);
    console.log('OK: /check/now rejects an invalid bearer secret');

    const webhookResponse = await fetch(baseUrl + '/telegram/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': 'wrong-webhook-secret',
      },
      body: JSON.stringify({ update_id: 1 }),
    });
    assert.equal(webhookResponse.status, 401);
    console.log('OK: Telegram webhook rejects an invalid secret');

    console.log('All application smoke checks passed.');
  } finally {
    await stopChild(child);
    for (const file of [pendingFile, pendingFile + '.tmp']) {
      try { fs.unlinkSync(file); } catch (err) {
        if (err.code !== 'ENOENT') throw err;
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
