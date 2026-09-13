const Anthropic = require('@anthropic-ai/sdk');
const { z } = require('zod');
const { zodOutputFormat } = require('@anthropic-ai/sdk/helpers/zod');

const client = new Anthropic(); // берёт ANTHROPIC_API_KEY из окружения
const MODEL = 'claude-opus-5';

const CriterionSchema = z.object({
  present: z.boolean().describe('Есть ли этот сигнал у компании — да/нет'),
  confidence: z
    .enum(['high', 'medium', 'low'])
    .describe('Насколько уверенно это видно из данных, а не додумано'),
  evidence: z
    .string()
    .describe('Короткое обоснование со ссылкой на конкретный факт из данных'),
});

const AnalysisSchema = z.object({
  facts: z
    .array(z.string())
    .describe('Только то, что реально написано в предоставленных данных/на сайте — без домыслов'),
  hypothesis: z
    .string()
    .describe('Гипотеза о бизнес-процессах и возможных ручных операциях — явно как предположение, не как факт'),
  criteria: z.object({
    business_fit: CriterionSchema,
    repetitive_queries_signal: CriterionSchema,
    multi_location_or_scale: CriterionSchema,
    clear_automation_solution: CriterionSchema,
  }),
});

const MessageSchema = z.object({
  problem: z.string().describe('Возможная проблема бизнеса — конкретно, без общих слов'),
  solution: z.string().describe('Какое AI-решение TAINA может предложить'),
  message: z
    .string()
    .describe('Готовое персонализированное сообщение для отправки, на русском'),
});

const ANALYSIS_SYSTEM = `Ты — аналитик, который готовит квалификацию бизнес-лидов для TAINA \
(компания делает AI-ассистентов и автоматизацию бизнес-процессов, в т.ч. на базе RAG).

Твоя задача — разобрать одну компанию по открытым данным (карточка Google Maps + текст сайта, если есть).

Критически важно:
- В поле "facts" — ТОЛЬКО то, что реально написано в данных. Ничего не додумывай.
- В поле "hypothesis" — одна связная гипотеза о процессах/нагрузке компании, явно как предположение.
- Критерии (criteria) оценивай честно: если сигнала нет или данных мало — present:false и confidence:"low",
  не натягивай сигнал, которого не видно.
- Если сайта не было или текста мало — так и скажи в evidence, не выдумывай наблюдения.`;

const MESSAGE_SYSTEM = `Ты пишешь короткое персонализированное сообщение от TAINA для холодного \
контакта с бизнесом. TAINA делает AI-ассистентов/RAG и автоматизацию для бизнеса.

Требования к сообщению:
- Структура: конкретное наблюдение о бизнесе → гипотеза → понятная ценность → мягкий CTA.
- БЕЗ штампов: никаких "мы инновационная компания", "здравствуйте, мы предлагаем...".
- БЕЗ длинного рассказа про AI и технологии.
- БЕЗ обещаний конкретного ROI/экономии в деньгах — данных для этого нет.
- 3-5 предложений, на русском языке, тон — как будто пишет человек, а не рассылка.
- Обязательно опирайся на конкретные факты из анализа, а не на общие фразы, подходящие любой компании.`;

async function analyzeCompany({ company, niche, city, siteText, contacts }) {
  const userContent = [
    `Компания: ${company}`,
    `Ниша (по запросу поиска): ${niche}`,
    `Город: ${city}`,
    contacts ? `Контакты (с Google Maps): ${contacts}` : 'Контакты: не найдены',
    siteText
      ? `Текст с сайта компании (может быть обрезан):\n${siteText}`
      : 'Сайт не найден или недоступен — работай только по названию/нише/городу, честно отметь это в hypothesis и в evidence критериев.',
  ].join('\n\n');

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    system: ANALYSIS_SYSTEM,
    output_config: { effort: 'high', format: zodOutputFormat(AnalysisSchema) },
    messages: [{ role: 'user', content: userContent }],
  });

  return response.parsed_output;
}

async function draftMessage({ company, niche, city, facts, hypothesis }) {
  const userContent = [
    `Компания: ${company}`,
    `Ниша: ${niche}`,
    `Город: ${city}`,
    `Известные факты: ${facts.join('; ')}`,
    `Гипотеза о процессах: ${hypothesis}`,
  ].join('\n');

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 2000,
    system: MESSAGE_SYSTEM,
    output_config: { effort: 'high', format: zodOutputFormat(MessageSchema) },
    messages: [{ role: 'user', content: userContent }],
  });

  return response.parsed_output;
}

module.exports = { analyzeCompany, draftMessage };
