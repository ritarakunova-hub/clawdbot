/**
 * Публикация на стену сообщества VK через VK API (wall.post).
 * Используется токен сообщества (Management → Работа с API → Создать
 * ключ доступа) — не личный OAuth-токен: для паблика это безопасный
 * и рекомендованный VK способ автоматизации, без риска для аккаунта.
 */

const API_VERSION = process.env.VK_API_VERSION || '5.199';

/**
 * Собирает параметры запроса к wall.post — вынесено в чистую функцию,
 * чтобы протестировать без реального обращения к VK.
 */
function buildWallPostParams({ groupId, message, accessToken }) {
  return {
    owner_id: String(-Math.abs(Number(groupId))), // паблики — всегда отрицательный owner_id
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
  const url = `https://api.vk.com/method/wall.post?${new URLSearchParams(params)}`;

  const res = await fetch(url, { method: 'POST' });
  const body = await res.json();

  if (body.error) {
    throw new Error(`VK API вернул ошибку ${body.error.error_code}: ${body.error.error_msg}`);
  }

  return body.response; // { post_id: ... }
}

module.exports = { postToWall, buildWallPostParams };
