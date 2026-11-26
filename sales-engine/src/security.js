const crypto = require('node:crypto');

function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || !left || !right) return false;
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function verifyBasicAuth(header, expectedUser, expectedPassword) {
  if (!expectedUser || !expectedPassword || typeof header !== 'string') return false;
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/.exec(header);
  if (!match) return false;
  let decoded;
  try {
    decoded = Buffer.from(match[1], 'base64').toString('utf8');
  } catch {
    return false;
  }
  const separator = decoded.indexOf(':');
  if (separator < 1) return false;
  return safeEqual(decoded.slice(0, separator), expectedUser) &&
    safeEqual(decoded.slice(separator + 1), expectedPassword);
}

function parseCookies(header) {
  const result = Object.create(null);
  if (typeof header !== 'string') return result;
  for (const segment of header.split(';')) {
    const index = segment.indexOf('=');
    if (index < 1) continue;
    const key = segment.slice(0, index).trim();
    const value = segment.slice(index + 1).trim();
    if (/^[A-Za-z0-9_-]{1,80}$/.test(key)) result[key] = value;
  }
  return result;
}

function verifyCsrf(req, expectedHost) {
  if (!req || !req.body || typeof req.body._csrf !== 'string') return false;
  const cookies = parseCookies(req.headers && req.headers.cookie);
  const cookieToken = cookies['__Host-taina-csrf'] || cookies['taina-csrf'];
  if (!safeEqual(cookieToken || '', req.body._csrf)) return false;

  const origin = req.headers && req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== expectedHost) return false;
    } catch {
      return false;
    }
  }
  const fetchSite = req.headers && req.headers['sec-fetch-site'];
  if (fetchSite && !['same-origin', 'none'].includes(fetchSite)) return false;
  return true;
}

function verifyTelegramCallback(callback, adminUserId, chatId, expectedMessageId) {
  if (!callback || !adminUserId || !chatId) return false;
  const message = callback.message;
  if (!message || !message.chat || message.message_id === undefined) return false;
  const identityMatches = String(callback.from && callback.from.id) === String(adminUserId) &&
    String(message.chat.id) === String(chatId);
  if (!identityMatches) return false;
  if (arguments.length >= 4) {
    return expectedMessageId !== undefined && expectedMessageId !== null &&
      String(message.message_id) === String(expectedMessageId);
  }
  return true;
}

function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safePositiveInteger(value) {
  return typeof value === 'string' && /^[1-9]\d{0,17}$/.test(value) &&
    Number.isSafeInteger(Number(value));
}

module.exports = {
  safeEqual,
  verifyBasicAuth,
  parseCookies,
  verifyCsrf,
  verifyTelegramCallback,
  escapeHtml,
  safePositiveInteger
};
