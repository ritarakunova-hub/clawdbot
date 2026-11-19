const fs = require('fs');
const path = require('path');

const PENDING_PATH = process.env.PENDING_FILE || path.join(__dirname, '..', 'data', 'pending.json');
const TEMP_PATH = PENDING_PATH + '.tmp';

function loadPending() {
  if (!fs.existsSync(PENDING_PATH)) return null;

  let pending;
  try {
    pending = JSON.parse(fs.readFileSync(PENDING_PATH, 'utf-8'));
  } catch (err) {
    throw new Error('Не удалось прочитать состояние черновика: ' + err.message);
  }

  if (!pending || typeof pending !== 'object' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(String(pending.postId || '')) ||
      typeof pending.text !== 'string') {
    throw new Error('Файл состояния черновика повреждён: публикация заблокирована до ручной проверки');
  }
  return pending;
}

function savePending(pending) {
  fs.mkdirSync(path.dirname(PENDING_PATH), { recursive: true });
  fs.writeFileSync(TEMP_PATH, JSON.stringify(pending, null, 2), { encoding: 'utf-8', mode: 0o600 });
  fs.renameSync(TEMP_PATH, PENDING_PATH);
}

function clearPending() {
  for (const file of [PENDING_PATH, TEMP_PATH]) {
    try {
      fs.unlinkSync(file);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
}

module.exports = { loadPending, savePending, clearPending };
