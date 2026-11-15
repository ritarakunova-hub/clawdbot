/**
 * Публикация вызывается только после явного подтверждения.
 * Площадки независимы: фиксируем частичный сбой и не повторяем отправку вслепую.
 */
const telegram = require('./telegram');
const vk = require('./vk');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function publish(content) {
  const post = typeof content === 'string' ? { text: content } : (content || {});
  const vkText = post.text || post.vkText || '';
  const telegramText = post.telegramText || vkText;
  const results = { telegram: null, vk: null };

  try {
    await telegram.sendChannelPost(telegramText);
    results.telegram = 'ok';
  } catch (err) {
    results.telegram = 'ошибка: ' + err.message;
  }

  try {
    await vk.postToWall(vkText);
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
    'Telegram-канал: ' + (results.telegram === 'ok' ? '✅' : '⚠️ ' + escapeHtml(results.telegram)),
    'VK: ' + (results.vk === 'ok' ? '✅' : '⚠️ ' + escapeHtml(results.vk))
  ];

  if (!complete) {
    lines.push('Не повторяйте отправку вслепую: сначала проверьте обе площадки, чтобы не создать дубликаты.');
  }
  return lines.join('\n');
}

module.exports = { publish, formatPublishSummary };
