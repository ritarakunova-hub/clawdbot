/**
 * Состояние текущего черновика, ожидающего публикации — храним в файле,
 * а не только в памяти, чтобы пережить перезапуск сервиса (Amvera может
 * перезапустить контейнер в середине 30-минутного окна).
 */
const fs = require('fs');
const path = require('path');

const PENDING_PATH = path.join(__dirname, '..', 'data', 'pending.json');

function loadPending() {
  try {
    return JSON.parse(fs.readFileSync(PENDING_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

function savePending(pending) {
  fs.writeFileSync(PENDING_PATH, JSON.stringify(pending, null, 2));
}

function clearPending() {
  try {
    fs.unlinkSync(PENDING_PATH);
  } catch {
    // файла и не было — нормально
  }
}

module.exports = { loadPending, savePending, clearPending };
