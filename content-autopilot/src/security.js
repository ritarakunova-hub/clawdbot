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

module.exports = { safeSecretEquals };
