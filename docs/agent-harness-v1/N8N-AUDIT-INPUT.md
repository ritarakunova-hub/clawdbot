# TAINA Agent Harness V1 — входные данные для аудита n8n

**Цель:** получить достаточно структуры для аудита четырёх существующих message workflows, не передавая секреты и реальные персональные данные.

## 1. Что нужно передать

Четыре JSON-экспорта workflow из n8n, по одному файлу на каждый сценарий. Названия файлов можно сделать нейтральными: `workflow-01.json` … `workflow-04.json`.

Для каждого workflow приложить короткую запись:
- назначение;
- чем запускается (schedule, webhook, Telegram event, другой workflow);
- какие другие workflow вызывает;
- что сейчас работает;
- где возникает ошибка или что ещё не закончено;
- production / test / disabled — фактическое состояние.

## 2. Что обязательно удалить или заменить

Перед отправкой проверь JSON на секреты. Удалить/заменить:
- API keys, tokens и passwords;
- Telegram bot token, webhook secret и admin secret;
- Google service account JSON / private key;
- Authorization / Bearer / Basic headers;
- значения cookies, session IDs, signed URLs и webhook URLs с секретными параметрами;
- реальные имена, телефоны, email, тексты клиентских обращений и другие персональные данные.

Значения можно заменить строками вроде `REDACTED_SECRET`, `TEST_CHAT_ID`, `SYNTHETIC_EMAIL`. Не присылать .env, credential export, реальные execution payloads или скриншоты с секретами.

## 3. Что нужно сохранить для технического аудита

Не удалять:
- типы nodes и версии node types, если они присутствуют;
- имена nodes и workflow;
- connections и порядок выполнения;
- выражения и mapping между nodes;
- параметры retries, timeout, error branches и continue-on-fail;
- настройки execution и error workflow;
- ссылки на credential types, если сами секретные значения удалены;
- названия API/сервисов и имена переменных окружения без их значений.

Если неясно, является ли поле секретом, замени только его значение, сохранив ключ и тип поля.

## 4. Что я сделаю с экспортами

Для каждого файла подготовлю:
1. схему входов и выходов;
2. карту node flow и межworkflow-вызовов;
3. список API и нужных credentials по типам;
4. повторяющиеся блоки;
5. обработку ошибок, повторов и дублирующихся событий;
6. точки внешних side effects и необходимые approvals;
7. mapping в Task Contract V1;
8. безопасный план изменений с rollback.

До согласования карты и плана не меняю исходные workflow и production.

## 5. Важное различие

JSON-экспорт workflow не содержит подтверждения фактического production-поведения. Для этого отдельно сверим настройки активного workflow, hosting/runtime, webhooks, persistent storage и последние ошибки — без доступа к значениям секретов.
