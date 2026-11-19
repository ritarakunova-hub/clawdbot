/**
 * Публикация на стену сообщества VK через wall.post.
 * Токен передаётся в теле POST-запроса, а не в URL.
 */
const API_VERSION = process.env.VK_API_VERSION || '5.199';

function buildWallPostParams({ groupId, message, accessToken }) {
  const numericGroupId = Number(groupId);
  if (!Number.isSafeInteger(numericGroupId) || numericGroupId === 0) {
    throw new Error('VK_GROUP_ID должен быть целым ненулевым числом');
  }
  if (!accessToken) throw new Error('Не задан VK_COMMUNITY_TOKEN');

  return {
    owner_id: String(-Math.abs(numericGroupId)),
    message: String(message),
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
  const response = await fetch('https://api.vk.com/method/wall.post', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams(params).toString(),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error('VK API вернул HTTP ' + response.status);
  }
  if (!body || body.error) {
    const error = body && body.error;
    throw new Error(error
      ? 'VK API вернул ошибку ' + error.error_code + ': ' + error.error_msg
      : 'VK API вернул некорректный ответ');
  }
  if (!body.response || typeof body.response.post_id !== 'number') {
    throw new Error('VK API не подтвердил создание публикации');
  }
  return body.response;
}

module.exports = { postToWall, buildWallPostParams };
