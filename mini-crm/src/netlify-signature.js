const crypto = require('node:crypto');

function safeEqual(left, right) {
  if (!Buffer.isBuffer(left)) left = Buffer.from(String(left || ''), 'utf8');
  if (!Buffer.isBuffer(right)) right = Buffer.from(String(right || ''), 'utf8');
  if (left.length !== right.length || left.length === 0) return false;
  return crypto.timingSafeEqual(left, right);
}

/**
 * Netlify signs outgoing webhook requests as compact JWS (HS256).
 * The signed claims contain iss=netlify and sha256=SHA256(raw request body).
 * Verify the JWS and raw body before trusting or processing the submission.
 */
function verifyNetlifySignature(token, rawBody, secret) {
  if (typeof token !== 'string' || !token || !secret) return false;
  if (!Buffer.isBuffer(rawBody)) return false;

  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) return false;

  let header;
  let claims;
  let providedSignature;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    providedSignature = Buffer.from(parts[2], 'base64url');
  } catch {
    return false;
  }

  if (!header || header.alg !== 'HS256') return false;
  if (!claims || claims.iss !== 'netlify' || typeof claims.sha256 !== 'string') return false;

  const signingInput = parts[0] + '.' + parts[1];
  const expectedSignature = crypto.createHmac('sha256', secret)
    .update(signingInput)
    .digest();

  if (!safeEqual(providedSignature, expectedSignature)) return false;

  const actualBodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');
  return safeEqual(Buffer.from(claims.sha256, 'utf8'), Buffer.from(actualBodyHash, 'utf8'));
}

module.exports = { verifyNetlifySignature };
