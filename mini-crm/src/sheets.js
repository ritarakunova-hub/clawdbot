const { google } = require('googleapis');

const SHEET_NAME = 'Заявки';
const SHEET_RANGE = SHEET_NAME + '!A:L';
const SUBMISSION_LOOKUP_RANGE = SHEET_NAME + '!J2:L';

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
  if (!raw) throw new Error('Не задана GOOGLE_SERVICE_ACCOUNT_KEY_BASE64');

  let credentials;
  try {
    credentials = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 повреждена или не является base64 от JSON-ключа');
  }

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
}

function getSheetId() {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error('Не задана GOOGLE_SHEET_ID');
  return id;
}

function findSubmissionRow(rows, submissionId) {
  const index = (rows || []).findIndex((row) => row && row[0] === submissionId);
  if (index < 0) return null;

  const row = rows[index] || [];
  return {
    rowNumber: index + 2,
    consentStatus: row[1] || '',
    notificationStatus: row[2] || 'pending'
  };
}

async function getSheetsClient() {
  const auth = getAuth();
  return google.sheets({ version: 'v4', auth });
}

async function findSubmission(submissionId, client) {
  const sheets = client || await getSheetsClient();
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: SUBMISSION_LOOKUP_RANGE
  });
  return findSubmissionRow(result.data.values || [], submissionId);
}

async function appendLead(lead) {
  const sheets = await getSheetsClient();
  const existing = await findSubmission(lead.submission_id, sheets);
  if (existing) return { duplicate: true, ...existing };

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
    lead.submission_id,
    lead.consent_status || 'yes',
    'pending'
  ];

  const result = await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: SHEET_RANGE,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] }
  });

  const updatedRange = result.data && result.data.updates && result.data.updates.updatedRange;
  const match = typeof updatedRange === 'string' && updatedRange.match(/![A-Z]+(\d+):/);
  return {
    duplicate: false,
    rowNumber: match ? Number(match[1]) : null,
    notificationStatus: 'pending'
  };
}

async function setNotificationStatus(submissionId, status) {
  if (!['pending', 'sending', 'sent', 'failed'].includes(status)) {
    throw new Error('Недопустимый статус уведомления');
  }

  const sheets = await getSheetsClient();
  const found = await findSubmission(submissionId, sheets);
  if (!found) throw new Error('Заявка не найдена при обновлении статуса уведомления');

  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(),
    range: SHEET_NAME + '!L' + found.rowNumber,
    valueInputOption: 'RAW',
    requestBody: { values: [[status]] }
  });
}

module.exports = {
  appendLead,
  findSubmission,
  findSubmissionRow,
  setNotificationStatus,
  SHEET_NAME,
  SHEET_RANGE,
  SUBMISSION_LOOKUP_RANGE
};
