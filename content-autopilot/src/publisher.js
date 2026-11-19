const telegram = require('./telegram');
const vk = require('./vk');

async function attemptPublish(send, text) {
  try {
    await send(text);
    return 'ok';
  } catch (err) {
    return 'ошибка: ' + (err && err.message ? err.message : String(err));
  }
}

/**
 * VK and Telegram are independent destinations. A destination confirmed
 * as published is skipped on retry to reduce duplicate posts.
 */
async function publish(text, {
  alreadyPublished = {},
  sendToTelegram = telegram.sendChannelPost,
  sendToVk = vk.postToWall,
} = {}) {
  const telegramResult = alreadyPublished.telegram
    ? 'ok'
    : await attemptPublish(sendToTelegram, text);
  const vkResult = alreadyPublished.vk
    ? 'ok'
    : await attemptPublish(sendToVk, text);

  return { telegram: telegramResult, vk: vkResult };
}

function formatPublishSummary(results, { auto = false, remaining = false } = {}) {
  const heading = auto
    ? '⏱ Автопубликация по включённой настройке'
    : '📣 Результат публикации по вашему подтверждению';
  const lines = [
    heading,
    'Telegram-канал: ' + (results.telegram === 'ok' ? '✅ опубликовано' : '⚠️ ' + (results.telegram || 'не подтверждено')),
    'VK: ' + (results.vk === 'ok' ? '✅ опубликовано' : '⚠️ ' + (results.vk || 'не подтверждено')),
  ];
  if (remaining) {
    lines.push('Черновик сохранён. После проверки ошибки нажмите «Опубликовать сейчас» ещё раз. Подтверждённая площадка повторно не отправится.');
  }
  return lines.join('\n');
}

module.exports = { publish, formatPublishSummary };
