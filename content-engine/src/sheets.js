const { google } = require('googleapis');

const SHEET_NAME = 'Посты';
// Порядок колонок — держите таблицу ровно в этом порядке:
const COLUMNS = [
  'id', 'topic', 'brief', 'text', 'hashtags', 'platforms',
  'status', 'created_at', 'last_status_update',
  'telegram_message_id', 'published_at', 'notes',
];

function colLetter(index) {
  return String.fromCharCode('A'.charCodeAt(0) + index);
}

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
  if (!raw) {
    throw new Error('Не задана переменная окружения GOOGLE_SERVICE_ACCOUNT_KEY_BASE64');
  }
  let credentials;
  try {
    credentials = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 повреждена или не base64 от JSON-ключа');
  }
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function getSheetId() {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error('Не задана переменная окружения GOOGLE_SHEET_ID');
  return id;
}

async function getSheetsClient() {
  const auth = getAuth();
  return google.sheets({ version: 'v4', auth });
}

function rowToPost(row) {
  const post = {};
  COLUMNS.forEach((key, i) => {
    post[key] = row[i] || '';
  });
  return post;
}

/**
 * Добавляет одну строку поста. post — объект с ключами из COLUMNS
 * (недостающие поля станут пустой строкой). Возвращает id.
 */
async function appendPost(post) {
  const sheets = await getSheetsClient();
  const row = COLUMNS.map((key) => (post[key] !== undefined ? post[key] : ''));
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: `${SHEET_NAME}!A:${colLetter(COLUMNS.length - 1)}`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
  return post.id;
}

async function findRowById(id) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: `${SHEET_NAME}!A2:A`,
  });
  const rows = res.data.values || [];
  const index = rows.findIndex((row) => row[0] === id);
  if (index === -1) return null;
  return index + 2; // +1 за заголовок, +1 — индексация с 1
}

async function getPostById(id) {
  const rowNumber = await findRowById(id);
  if (!rowNumber) return null;
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: `${SHEET_NAME}!A${rowNumber}:${colLetter(COLUMNS.length - 1)}${rowNumber}`,
  });
  const row = (res.data.values || [])[0] || [];
  return rowToPost(row);
}

/**
 * Точечно обновляет несколько полей одной строки за один запрос.
 * last_status_update проставляется автоматически, если не передан явно.
 */
async function updateFields(id, fields) {
  const rowNumber = await findRowById(id);
  if (!rowNumber) return false;

  const toWrite = { last_status_update: new Date().toISOString(), ...fields };
  const data = Object.entries(toWrite)
    .filter(([key]) => COLUMNS.includes(key))
    .map(([key, value]) => ({
      range: `${SHEET_NAME}!${colLetter(COLUMNS.indexOf(key))}${rowNumber}`,
      values: [[value]],
    }));

  if (!data.length) return false;

  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: getSheetId(),
    requestBody: { valueInputOption: 'USER_ENTERED', data },
  });
  return true;
}

async function updateStatus(id, status) {
  return updateFields(id, { status });
}

module.exports = {
  COLUMNS,
  SHEET_NAME,
  appendPost,
  getPostById,
  updateFields,
  updateStatus,
};
