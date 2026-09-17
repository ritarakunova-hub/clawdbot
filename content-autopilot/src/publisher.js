/**
 * Публикация в оба канала сразу. Площадки независимы: если одна упала,
 * вторая всё равно публикуется — и в личном чате будет видно, что именно
 * не получилось, а не тишина.
 */
const telegram = require('./telegram');
const vk = require('./vk');

async function publish(text) {
  const results = { telegram: null, vk: null };

  try {
    await telegram.sendChannelPost(text);
    results.telegram = 'ok';
  } catch (err) {
    results.telegram = `ошибка: ${err.message}`;
  }

  try {
    await vk.postToWall(text);
    results.vk = 'ok';
  } catch (err) {
    results.vk = `ошибка: ${err.message}`;
  }

  return results;
}

function formatPublishSummary(results, { auto }) {
  const heading = auto
    ? '⏱ Автопубликация по таймеру завершена'
    : '✅ Опубликовано вручную';
  const lines = [
    heading,
    `Telegram-канал: ${results.telegram === 'ok' ? '✅' : '⚠️ ' + results.telegram}`,
    `VK: ${results.vk === 'ok' ? '✅' : '⚠️ ' + results.vk}`,
  ];
  return lines.join('\n');
}

module.exports = { publish, formatPublishSummary };
