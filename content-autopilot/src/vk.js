/**
 * Публикация на стену сообщества VK через VK API (wall.post).
 * Токен передаётся в POST body, а не в URL query string.
 */
const API_VERSION = process.env.VK_API_VERSION || '5.199';
const REQUEST_TIMEOUT_MS = 15000;

function buildWallPostParams({ groupId, message, accessToken }) {
  const rawGroupId = String(groupId ?? '').trim();
  if (!/^-?\d+$/.test(rawGroupId)) {
    throw new Error('VK_GROUP_ID должен быть целым положительным ID сообщества');
  }
  const absoluteGroupId = BigInt(rawGroupId);
  const normalizedGroupId = absoluteGroupId < 0n ? -absoluteGroupId : absoluteGroupId;
  if (normalizedGroupId <= 0n || normalizedGroupId > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('VK_GROUP_ID должен быть положительным безопасным целым числом');
  }
  return {
    owner_id: '-' + normalizedGroupId.toString(),
    message,
    from_group: '1',
    access_token: accessToken,
    v: API_VERSION,
  };
}

async function postToWall(message) {
  const groupId = process.env.VK_GROUP_ID;
  const accessToken = process.env.VK_COMMUNITY_TOKEN;
  if (!groupId || !accessToken) {
    throw new Error('Не заданы переменные окружения VK_GROUP_ID / VK_COMMUNITY_TOKEN');
  }

  const params = buildWallPostParams({ groupId, message, accessToken });
  const res = await fetch('https://api.vk.com/method/wall.post', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(15000)
  });

  let body;
  try {
    body = await res.json();
  } catch {
    throw new Error('VK API вернул невалидный JSON, HTTP ' + res.status);
  }

  if (!res.ok) {
    throw new Error('VK API вернул HTTP ' + res.status);
  }
  if (body && body.error) {
    throw new Error('VK API вернул ошибку ' + body.error.error_code + ': ' + body.error.error_msg);
  }

  const postId = body && body.response && body.response.post_id;
  if (!Number.isSafeInteger(Number(postId)) || Number(postId) <= 0) {
    throw new Error('VK API не вернул подтверждение созданной записи');
  }

  return body.response;
}

module.exports = { postToWall, buildWallPostParams };
