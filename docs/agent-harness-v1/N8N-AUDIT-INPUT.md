# TAINA n8n workflows — входные данные для runtime-сверки

**Статус на 2026-11-27:** все четыре JSON-экспорта найдены в `ritarakunova-hub/clawdbot1`, ветка `claude/eager-ptolemy-ktb3lq`. Их статический аудит выполнен. Повторно присылать эти файлы не нужно.

## Найденные файлы

- `automation/mini-crm/workflow-1-new-lead.json`
- `automation/mini-crm/workflow-2-reminders.json`
- `automation/sales-engine/workflow-3-lead-finder.json`
- `automation/sales-engine/workflow-4-approval-handler.json`
- `automation/apps-script/Code.gs`
- `automation/README.md`
- `automation/test/test.md`

Полный разбор: [N8N-WORKFLOW-AUDIT-2026-11-27.md](./N8N-WORKFLOW-AUDIT-2026-11-27.md).

## Следующий вход — только runtime status

Для подтверждения текущей конфигурации нужны безопасные сведения из n8n:
1. Версия n8n.
2. Список workflow с именами, active/inactive и последним execution status.
3. Подтверждение, что эти четыре workflow импортированы из найденной ветки или более новой версии.
4. Имена и типы credentials без значений credential.
5. Настроен ли Netlify outgoing webhook и на какой workflow (покажи только hostname/path без токенов).
6. Версия последнего Apps Script deployment и активен ли URL.
7. Есть ли тестовая Google Sheet с ожидаемыми заголовками.
8. Есть ли отдельный тестовый Telegram chat.

Не присылай реальные токены, credential values, контакты или execution payloads. Секреты не нужны для аудита.

## Если workflow менялись после найденной версии

Передавай только обновлённые sanitized JSON. Удали API keys, tokens, passwords, Telegram bot token, webhook secret, Google service account JSON/private key, Authorization/Bearer/Basic headers, cookies/session IDs/signed URLs и реальные персональные данные.

Сохрани node types/versions, connections, параметры, expressions, error branches, retries/timeouts, execution settings и credential type/name. Заменяй только чувствительные значения, не удаляй структуру.

## Этап до включения

Не импортировать и не включать вслепую. Сначала устранить P0/P1 в порядке из аудита:
1. Авторизация Telegram callback.
2. Netlify webhook signature verification и idempotency.
3. Минимизация PII и перенос GET-token операций в POST.
4. Атомарная запись/дедупликация через Apps Script LockService.
5. Безопасная доставка Telegram review card с recovery.
6. Строгая схема GigaChat JSON.

После этого — synthetic end-to-end test и только затем решение о контролируемой активации.