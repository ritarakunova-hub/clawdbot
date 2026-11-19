const { timingSafeEqual } = require('node:crypto');

function safeEqual(actual, expected) {
  const left = Buffer.from(String(actual || ''));
  const right = Buffer.from(String(expected || ''));
  return left.length === right.length && timingSafeEqual(left, right);
}

function isInternalRequestAuthorized(header, secret) {
  if (!secret) return false;
  return safeEqual(header, 'Bearer ' + secret);
}

function isTelegramWebhookAuthorized(header, secret) {
  if (!secret) return false;
  return safeEqual(header, secret);
}

function isTelegramOwnerCallback(callback, ownerChatId) {
  if (!callback || !callback.message || !callback.message.chat || !callback.from || !ownerChatId) {
    return false;
  }
  return safeEqual(callback.message.chat.id, ownerChatId)
    && safeEqual(callback.from.id, ownerChatId);
}

module.exports = {
  isInternalRequestAuthorized,
  isTelegramWebhookAuthorized,
  isTelegramOwnerCallback,
};
