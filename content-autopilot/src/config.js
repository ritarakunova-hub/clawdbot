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

function isTelegramOwnerCallback(callback, ownerChatId, approverId, expectedMessageId) {
  if (!callback || !callback.message || !callback.message.chat || !callback.from ||
      !ownerChatId || !approverId || expectedMessageId === undefined || expectedMessageId === null) {
    return false;
  }

  // Bind approval to all three identities: private chat, human approver and exact draft message.
  return safeEqual(callback.message.chat.id, ownerChatId)
    && safeEqual(callback.from.id, approverId)
    && safeEqual(callback.message.message_id, expectedMessageId);
}

module.exports = {
  isInternalRequestAuthorized,
  isTelegramWebhookAuthorized,
  isTelegramOwnerCallback,
};
