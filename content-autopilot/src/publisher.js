/**
 * Публикация вызывается только после явного подтверждения.
 * Площадки независимы: фиксируем частичный сбой и не повторяем отправку вслепую.
 */
const telegram = require('./telegram');
const vk = require('./vk');

async function publish(text) {
  const results = { telegram: null, vk: null };

  try {
    await telegram.sendChannelPost(text);
    results.telegram = 'ok';
  } catch (err) {
    results.telegram = 'ошибка: ' + err.message;
  }

  try {
    await vk.postToWall(text);
    results.vk = 'ok';
  } catch (err) {
    results.vk = 'ошибка: ' + err.message;
  }

  return results;
}

function formatPublishSummary(results) {
  const complete = results.telegram === 'ok' && results.vk === 'ok';
  const lines = [
    complete ? '✅ Публикация подтверждена и завершена на обеих площадках' : '⚠️ Публикация завершилась не полностью',
    'Telegram-канал: ' + (results.telegram === 'ok' ? '✅' : '⚠️ ' + results.telegram),
    'VK: ' + (results.vk === 'ok' ? '✅' : '⚠️ ' + results.vk)
  ];

  if (!complete) {
    lines.push('Не повторяйте отправку вслепую: сначала проверьте обе площадки, чтобы не создать дубликаты.');
  }
  return lines.join('\n');
}

module.exports = { publish, formatPublishSummary };
