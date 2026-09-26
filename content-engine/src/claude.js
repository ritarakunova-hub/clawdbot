const Anthropic = require('@anthropic-ai/sdk');
const { z } = require('zod');
const { zodOutputFormat } = require('@anthropic-ai/sdk/helpers/zod');

const client = new Anthropic(); // берёт ANTHROPIC_API_KEY из окружения
const MODEL = 'claude-opus-5';

const PostSchema = z.object({
  text: z
    .string()
    .describe('Готовый текст поста на русском — без markdown-разметки, только эмодзи и переносы строк'),
  hashtags: z
    .array(z.string())
    .describe('3-5 хэштегов без пробелов и без символа # (добавляется отдельно), на русском или английском — как принято в нише'),
});

const POST_SYSTEM = `Ты пишешь короткий пост для соцсетей (Telegram-канал/VK) от лица TAINA — \
компании, которая делает AI-ассистентов и автоматизацию бизнес-процессов (RAG, чат-боты, воронки продаж).

Требования:
- Живой человеческий тон, без штампов ("мы инновационная компания", "в современном мире").
- Структура: цепляющее первое предложение → суть/польза → мягкий вывод или вопрос к читателю.
- 4-8 предложений, можно короткие абзацы через пустую строку, эмодзи — по смыслу, не через слово.
- Никакой markdown-разметки (**, ##, [текст](url)) — только чистый текст, эмодзи и переносы строк.
- Хэштеги возвращай отдельно от текста, не вставляй их в сам текст поста.
- Опирайся только на бриф, который дал пользователь — не выдумывай факты, цифры или кейсы, которых там нет.`;

async function generatePost({ topic, brief }) {
  const userContent = [
    `Тема поста: ${topic}`,
    brief ? `Бриф/детали от автора: ${brief}` : 'Дополнительных деталей нет — раскрой тему сам, но без выдуманных фактов о конкретных клиентах или цифр.',
  ].join('\n\n');

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 1500,
    system: POST_SYSTEM,
    output_config: { effort: 'high', format: zodOutputFormat(PostSchema) },
    messages: [{ role: 'user', content: userContent }],
  });

  return response.parsed_output;
}

module.exports = { generatePost };
