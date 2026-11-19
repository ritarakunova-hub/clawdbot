const { timingSafeEqual } = require('node:crypto');

function safeEqual(actual, expected) {
  const left = Buffer.from(String(actual || ''));
  const right = Buffer.from(String(expected || ''));
  return left.length === right.length && timingSafeEqual(left, right);
}

function isTimedAutoPublishEnabled(env = process.env) {
  return env.AUTO_PUBLISH_ENABLED === 'true';
}

function isInternalRequestAuthorized(header, secret) {
  if (!secret) return false;
  return safeEqual(header, 'Bearer ' + secret);
}

function isTelegramWebhookAuthorized(header, secret) {
  if (!secret) return false;
  return safeEqual(header, secret);
}

module.exports = {
  isTimedAutoPublishEnabled,
  isInternalRequestAuthorized,
  isTelegramWebhookAuthorized,
};
