const { google } = require('googleapis');

const SHEET_NAME = 'Заявки';
const SHEET_RANGE = `${SHEET_NAME}!A:I`;

/**
 * Собирает Google Auth клиент из сервисного аккаунта.
 * Ключ сервисного аккаунта передаётся одной переменной окружения
 * (base64 от JSON-файла ключа) — так его проще один раз вставить
 * в личном кабинете Amvera, без возни с переносами строк в private_key.
 */
function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
  if (!raw) {
    throw new Error(
      'Не задана переменная окружения GOOGLE_SERVICE_ACCOUNT_KEY_BASE64'
    );
  }
  let credentials;
  try {
    credentials = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
  } catch (err) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 повреждена или не является base64 от JSON-ключа'
    );
  }
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function getSheetId() {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) {
    throw new Error('Не задана переменная окружения GOOGLE_SHEET_ID');
  }
  return id;
}

/**
 * Добавляет одну строку заявки в таблицу «Заявки».
 * Порядок колонок: name | email | phone | message | form_name | received_at | status | last_status_update | notes
 */
async function appendLead(lead) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const row = [
    lead.name || '',
    lead.email || '',
    lead.phone || '',
    lead.message || '',
    lead.form_name || '',
    lead.received_at,
    lead.status || 'Новая',
    lead.last_status_update || lead.received_at,
    lead.notes || '',
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: SHEET_RANGE,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

module.exports = { appendLead, SHEET_NAME, SHEET_RANGE };
