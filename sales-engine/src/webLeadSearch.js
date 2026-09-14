const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic(); // берёт ANTHROPIC_API_KEY из окружения
const MODEL = 'claude-opus-5';

/**
 * Поиск компаний через встроенный веб-поиск Claude — НЕ через
 * Google Maps / 2GIS / Яндекс.Карты и вообще без директорий бизнеса.
 * Обычный интернет-поиск: Claude ищет сайты компаний по нише+городу
 * и берёт адреса (URL) прямо из результатов поиска.
 *
 * Один и тот же Anthropic-аккаунт, что и для анализа/scoring —
 * отдельного сервиса заводить не нужно. Веб-поиск стоит $10 за 1000
 * запросов ($0.01 за один поиск), один прогон делает несколько поисков
 * с разными формулировками — расход в пределах нескольких центов.
 *
 * Честный минус: телефон компании веб-поиск находит реже, чем
 * специализированные бизнес-справочники — иногда его придётся
 * находить вручную на сайте компании.
 */
const SEARCH_SYSTEM = `Ты помогаешь найти реальные существующие компании через веб-поиск \
для холодных продаж TAINA (AI-автоматизация бизнеса).

Правила:
- Ищи только реально существующие компании — то, что нашёл через веб-поиск.
  НИКОГДА не выдумывай компании, сайты или телефоны.
- Используй поиск несколько раз с разными формулировками запроса
  (разные районы города, синонимы ниши), чтобы набрать разнообразный список,
  а не дублировать одни и те же компании из первой выдачи.
- Для каждой компании укажи: name (название), site (полный URL официального
  сайта — только если реально нашёл), phone (телефон, только если удалось
  найти в поиске или на сайте — иначе пустая строка, не выдумывай).
- Пропускай агрегаторы, маркетплейсы и справочники (2ГИС, Яндекс.Карты,
  Zoon и т.п.) — нужны сайты самих компаний, не третьих лиц.

В конце ответа выведи ТОЛЬКО JSON-массив в блоке \`\`\`json ... \`\`\`,
без текста до или после блока. Формат:
[{"name": "...", "site": "...", "phone": "..."}]`;

function extractJsonArray(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : (text.match(/(\[[\s\S]*\])/) || [])[1];
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Ищет компании по нише+городу. Возвращает "сырые" карточки в формате
 * { name, site, phone }.
 */
async function searchCompanies(niche, city, limit) {
  const query = `${niche} ${city}`.trim();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SEARCH_SYSTEM,
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }],
    messages: [
      {
        role: 'user',
        content: `Найди до ${limit} компаний по запросу: "${query}". Используй веб-поиск несколько раз с разными формулировками, чтобы набрать разнообразный список, а не только первые результаты одного запроса.`,
      },
    ],
  });

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  const places = extractJsonArray(text);

  return places.slice(0, limit).map((place) => ({
    name: (place && place.name) || '',
    site: (place && place.site) || '',
    phone: (place && place.phone) || '',
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

module.exports = { searchCompanies, normalizeDomain, extractJsonArray };
