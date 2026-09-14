const { google } = require('googleapis');

const SHEET_NAME = 'Лиды';
// Порядок колонок — держите таблицу ровно в этом порядке:
const COLUMNS = [
  'id', 'domain', 'company', 'niche', 'city', 'source', 'contacts',
  'site_summary', 'ai_analysis', 'score', 'score_reason', 'data_confidence',
  'problem', 'solution', 'message', 'status', 'follow_up_count',
  'first_contact_date', 'last_status_update', 'notes',
];

function colLetter(index) {
  // 0 -> A, 1 -> B, ... простая реализация, колонок у нас < 26
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

function normalizeKey(str) {
  return String(str || '').trim().toLowerCase();
}

function rowToLead(row) {
  const lead = {};
  COLUMNS.forEach((key, i) => {
    lead[key] = row[i] || '';
  });
  return lead;
}

/**
 * Читает всю таблицу и строит набор ключей для дедапа:
 * домен, если есть, иначе "название|город".
 */
async function getExistingKeys() {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: `${SHEET_NAME}!A2:E`, // id, domain, company, niche, city
  });
  const rows = res.data.values || [];
  const keys = new Set();
  for (const row of rows) {
    const domain = normalizeKey(row[1]);
    const company = normalizeKey(row[2]);
    const city = normalizeKey(row[4]);
    if (domain) keys.add(domain);
    else if (company) keys.add(`${company}|${city}`);
  }
  return keys;
}

/**
 * Читает все строки таблицы как объекты-лиды (с номером строки —
 * нужен внутри модуля для точечных обновлений).
 */
async function getAllLeads() {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: `${SHEET_NAME}!A2:${colLetter(COLUMNS.length - 1)}`,
  });
  const rows = res.data.values || [];
  return rows.map((row, i) => ({ ...rowToLead(row), _row: i + 2 }));
}

/**
 * Добавляет одну строку лида. lead — объект с ключами из COLUMNS
 * (недостающие поля станут пустой строкой).
 */
async function appendLead(lead) {
  const sheets = await getSheetsClient();
  const row = COLUMNS.map((key) => (lead[key] !== undefined ? lead[key] : ''));
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: `${SHEET_NAME}!A:${colLetter(COLUMNS.length - 1)}`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

/**
 * Находит номер строки (1-indexed, с учётом заголовка) по id лида.
 * Возвращает null, если не найдено.
 */
async function findRowById(id) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: `${SHEET_NAME}!A2:A`,
  });
  const rows = res.data.values || [];
  const index = rows.findIndex((row) => row[0] === id);
  if (index === -1) return null;
  return index + 2; // +2: +1 за заголовок, +1 потому что индексация с 1
}

/**
 * Возвращает данные строки лида по id (объект с ключами из COLUMNS) или null.
 */
async function getLeadById(id) {
  const rowNumber = await findRowById(id);
  if (!rowNumber) return null;
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: `${SHEET_NAME}!A${rowNumber}:${colLetter(COLUMNS.length - 1)}${rowNumber}`,
  });
  const row = (res.data.values || [])[0] || [];
  return rowToLead(row);
}

/**
 * Точечно обновляет несколько полей одной строки за один запрос.
 * fields — объект { имя_колонки: значение }. last_status_update
 * проставляется автоматически, если не передан явно.
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

/**
 * Обновляет статус лида (и дату последнего обновления).
 */
async function updateStatus(id, status) {
  return updateFields(id, { status });
}

/**
 * Отмечает, что вы одобрили и отправили сообщение: статус "Отправлено",
 * с этого момента начинается отсчёт до follow-up. first_contact_date
 * проставляется только один раз — при самом первом одобрении.
 */
async function markApproved(id) {
  const lead = await getLeadById(id);
  if (!lead) return false;
  const fields = { status: 'Отправлено' };
  if (!lead.first_contact_date) {
    fields.first_contact_date = new Date().toISOString();
  }
  return updateFields(id, fields);
}

module.exports = {
  COLUMNS,
  SHEET_NAME,
  getExistingKeys,
  getAllLeads,
  appendLead,
  getLeadById,
  updateStatus,
  updateFields,
  markApproved,
  normalizeKey,
};
