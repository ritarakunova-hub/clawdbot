const crypto = require('node:crypto');

function safeSecretEquals(candidate, expected) {
  if (typeof candidate !== 'string' || typeof expected !== 'string' || expected.length === 0) {
    return false;
  }

  const candidateBytes = Buffer.from(candidate, 'utf8');
  const expectedBytes = Buffer.from(expected, 'utf8');
  if (candidateBytes.length !== expectedBytes.length) return false;
  return crypto.timingSafeEqual(candidateBytes, expectedBytes);
}

function sameId(left, right) {
  return left !== undefined && right !== undefined && String(left) === String(right);
}

/**
 * Only the configured approver may act on the exact Telegram message
 * created for the current pending draft. A copied/old callback is rejected.
 */
function isAuthorizedCallback(callback, pending, approverId) {
  if (!callback || !pending || !approverId ||
      !pending.telegramChatId || !pending.telegramMessageId) {
    return false;
  }

  const message = callback.message;
  if (!message || !message.chat) return false;

  return sameId(callback.from && callback.from.id, approverId) &&
    sameId(message.chat.id, pending.telegramChatId) &&
    sameId(message.message_id, pending.telegramMessageId);
}

module.exports = { safeSecretEquals, isAuthorizedCallback };
