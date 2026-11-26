const fs = require('node:fs');
const path = require('node:path');

const REQUIRED_SETTINGS = [
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'TELEGRAM_APPROVER_ID',
  'TELEGRAM_WEBHOOK_SECRET',
  'INTERNAL_API_SECRET',
  'PENDING_FILE',
];

function getReadiness(env = process.env) {
  const missing = REQUIRED_SETTINGS.filter((name) => !String(env[name] || '').trim());
  const invalid = [];
  const approverId = String(env.TELEGRAM_APPROVER_ID || '').trim();
  if (approverId && (!/^[1-9]\\d*$/.test(approverId) || !Number.isSafeInteger(Number(approverId)))) {
    invalid.push('TELEGRAM_APPROVER_ID');
  }

  let storageWritable = false;
  let storageProbeDirectory = null;
  try {
    const pendingPath = env.PENDING_FILE ? path.resolve(env.PENDING_FILE) : null;
    if (pendingPath) {
      const parent = path.dirname(pendingPath);
      fs.mkdirSync(parent, { recursive: true });
      storageProbeDirectory = fs.mkdtempSync(path.join(parent, '.taina-ready-'));
      const probeFile = path.join(storageProbeDirectory, 'probe');
      fs.writeFileSync(probeFile, 'ok', { flag: 'wx', mode: 0o600 });
      fs.unlinkSync(probeFile);
      fs.rmdirSync(storageProbeDirectory);
      storageProbeDirectory = null;
      storageWritable = true;
    }
  } catch {
    storageWritable = false;
  } finally {
    if (storageProbeDirectory) {
      try { fs.rmSync(storageProbeDirectory, { recursive: true, force: true }); } catch {}
    }
  }

  if (!storageWritable && !missing.includes('PENDING_FILE')) {
    invalid.push('PENDING_FILE');
  }

  return {
    ready: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
    storageWritable,
    publisher: 'SMMplanner',
    directPublishing: false,
  };
}

module.exports = { getReadiness, REQUIRED_SETTINGS };
