/**
 * Скачивает сайт компании и превращает HTML в чистый текст для анализа.
 * Если сайта нет, он недоступен или на нём почти нет текста —
 * возвращает null, и дальше система честно помечает это как
 * "мало данных", а не выдумывает анализ на пустом месте.
 */
async function fetchSiteText(site) {
  if (!site) return null;

  const url = site.startsWith('http') ? site : `https://${site}`;

  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TAINA-SalesEngine/1.0)' },
    });
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('html')) return null;

    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&laquo;/g, '«')
      .replace(/&raquo;/g, '»')
      .replace(/\s+/g, ' ')
      .trim();

    if (text.length < 50) return null; // страница почти пустая — не считаем сайтом с данными

    return text.slice(0, 6000);
  } catch {
    return null; // сайт не открылся — не критично, работаем с тем что есть
  }
}

module.exports = { fetchSiteText };
