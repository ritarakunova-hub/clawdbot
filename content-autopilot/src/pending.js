/**
 * Текущее состояние черновика. Запись выполняется атомарно,
 * чтобы перезапуск контейнера не оставил частично записанный JSON.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.CONTENT_AUTOPILOT_DATA_DIR || path.join(__dirname, '..', 'data');
const PENDING_PATH = path.join(DATA_DIR, 'pending.json');

function writeJsonAtomically(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = filePath + '.' + process.pid + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), { encoding: 'utf-8', mode: 0o600 });
  fs.renameSync(tempPath, filePath);
}

function loadPending() {
  try {
    return JSON.parse(fs.readFileSync(PENDING_PATH, 'utf-8'));
  } catch {
    return null;
  }
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
