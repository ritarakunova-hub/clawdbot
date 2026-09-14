/**
 * Ищет компании через Google Places API (New) — Text Search.
 * Тот же Google-аккаунт/проект, что уже используется для Google Sheets —
 * отдельный ключ (не сервисный аккаунт), см. README, раздел про Places API.
 *
 * Реальные данные (название, адрес) всегда попадают в тариф Pro, но
 * бесплатный лимит там — 5000 запросов в месяц. Один прогон TAINA — это
 * 1 запрос (плюс редко 1-2 догрузки страниц, если лимит > 20) — остаться
 * в бесплатной зоне практически невозможно не заметить.
 */

const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

// Только то, что реально используется дальше в пайплайне — не запрашиваем
// рейтинги/отзывы/фото, чтобы не улететь в более дорогой тариф Enterprise.
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.primaryType',
  'nextPageToken',
].join(',');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function searchPage(query, apiKey, pageToken) {
  const body = pageToken
    ? { pageToken }
    : { textQuery: query, languageCode: 'ru', maxResultCount: 20 };

  const res = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Places API вернул ${res.status}: ${errText}`);
  }

  return res.json();
}

/**
 * Ищет компании по нише+городу. Возвращает "сырые" карточки мест в
 * формате { name, site, phone } — том же, что раньше отдавал Outscraper,
 * чтобы остальной код (pipeline.js) не пришлось менять.
 */
async function searchCompanies(niche, city, limit) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error('Не задана переменная окружения GOOGLE_PLACES_API_KEY');
  }

  const query = `${niche} ${city}`.trim();
  const places = [];
  let pageToken;

  // Google отдаёт максимум 20 мест за страницу; догружаем следующие
  // страницы, пока не наберём нужный лимит (обычно хватает одной страницы).
  while (places.length < limit) {
    const data = await searchPage(query, apiKey, pageToken);
    const pagePlaces = data.places || [];
    places.push(...pagePlaces);

    if (!data.nextPageToken || pagePlaces.length === 0) break;
    pageToken = data.nextPageToken;
    // Google требует небольшую паузу, прежде чем pageToken станет рабочим.
    await sleep(2000);
  }

  return places.slice(0, limit).map((place) => ({
    name: (place.displayName && place.displayName.text) || '',
    site: place.websiteUri || '',
    phone: place.nationalPhoneNumber || '',
    address: place.formattedAddress || '',
    placeId: place.id || '',
  }));
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
