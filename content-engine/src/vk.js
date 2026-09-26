const API_VERSION = '5.199';

function isConfigured() {
  return Boolean(process.env.VK_ACCESS_TOKEN && process.env.VK_GROUP_ID);
}

/**
 * Публикует текст на стену сообщества VK. Если VK не настроен
 * (нет токена/id сообщества) — просто ничего не делает, чтобы Telegram
 * можно было использовать без VK.
 */
async function publishToWall(text) {
  if (!isConfigured()) return { skipped: true };

  const groupId = String(process.env.VK_GROUP_ID).replace(/^-/, '');
  const params = new URLSearchParams({
    owner_id: `-${groupId}`,
    from_group: '1',
    message: text,
    access_token: process.env.VK_ACCESS_TOKEN,
    v: API_VERSION,
  });

  const res = await fetch(`https://api.vk.com/method/wall.post?${params.toString()}`, {
    method: 'POST',
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(`VK API вернул ошибку: ${data.error.error_msg}`);
  }
  return data.response;
}

module.exports = { isConfigured, publishToWall };
