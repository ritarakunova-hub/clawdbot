/**
 * Текущее состояние черновика. Запись выполняется атомарно,
 * чтобы перезапуск контейнера не оставил частично записанный JSON.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.CONTENT_AUTOPILOT_DATA_DIR || path.join(__dirname, '..', 'data');
const PENDING_PATH = path.join(DATA_DIR, 'pending.json');

function writeJsonAtomically(filePath, value) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
  const tempPath = filePath + '.' + process.pid + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), { encoding: 'utf-8', mode: 0o600 });
  fs.renameSync(tempPath, filePath);
}

function loadPending() {
  let raw;
  try {
    raw = fs.readFileSync(PENDING_PATH, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }

  const pending = JSON.parse(raw);
  if (!pending || typeof pending !== 'object' || Array.isArray(pending) || typeof pending.postId !== 'string') {
    throw new Error('Файл pending.json повреждён или имеет неверный формат; публикация остановлена до проверки');
  }
  return pending;
}

function savePending(pending) {
  writeJsonAtomically(PENDING_PATH, pending);
}

function clearPending() {
  try {
    fs.unlinkSync(PENDING_PATH);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

module.exports = { loadPending, savePending, clearPending };
