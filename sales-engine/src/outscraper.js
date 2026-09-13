const Outscraper = require('outscraper');

/**
 * Ищет компании через Google Maps (Outscraper).
 * Возвращает "сырые" карточки мест — без анализа, просто то, что отдал Maps.
 */
async function searchCompanies(niche, city, limit) {
  const apiKey = process.env.OUTSCRAPER_API_KEY;
  if (!apiKey) {
    throw new Error('Не задана переменная окружения OUTSCRAPER_API_KEY');
  }

  const client = new Outscraper(apiKey);
  const query = `${niche} ${city}`.trim();

  // asyncRequest=false — просим синхронный ответ. Для небольших лимитов
  // (10-30, как и задумано для TAINA) Outscraper обычно отвечает сразу.
  const response = await client.googleMapsSearch(
    [query],
    limit,
    'ru',
    'ru',
    0,
    true, // dropDuplicates — не отдавать дубли внутри одного запроса
    null,
    false
  );

  // Если Outscraper всё же поставил запрос в очередь (бывает при нагрузке
  // на их стороне) — response придёт в виде {status, id, results_location}
  // вместо массива данных. Дожидаемся результата поллингом.
  if (response && !Array.isArray(response) && response.results_location) {
    return await pollResults(response.results_location, apiKey);
  }

  // googleMapsSearch с одним запросом в query возвращает массив вида
  // [[place, place, ...]] — один подмассив на каждый переданный запрос.
  if (Array.isArray(response) && Array.isArray(response[0])) {
    return response[0];
  }

  return Array.isArray(response) ? response : [];
}

async function pollResults(resultsLocation, apiKey, attempts = 12, delayMs = 5000) {
  for (let i = 0; i < attempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    const res = await fetch(resultsLocation, {
      headers: { 'X-API-KEY': apiKey },
    });
    const body = await res.json();
    if (body.status === 'Success' && Array.isArray(body.data)) {
      return Array.isArray(body.data[0]) ? body.data[0] : body.data;
    }
    if (body.status === 'Error') {
      throw new Error(`Outscraper вернул ошибку: ${JSON.stringify(body)}`);
    }
    // status "Pending" — ждём ещё
  }
  throw new Error('Outscraper не ответил вовремя (запрос завис в очереди)');
}

/**
 * Убирает протокол/www из адреса сайта, чтобы использовать как ключ дедапа.
 */
function normalizeDomain(site) {
  if (!site) return '';
  try {
    const url = site.startsWith('http') ? site : `https://${site}`;
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

module.exports = { searchCompanies, normalizeDomain };
