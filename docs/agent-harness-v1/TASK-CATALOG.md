# TAINA Agent Harness V1 — предварительный каталог задач

**Статус:** Draft / derived from source-code review  
**Назначение:** карта кандидатов для Task Registry, не утверждение о подключении этих сервисов к Harness.

Каталог отделяет бизнес-задачу, необходимость LLM, инструменты и внешние эффекты, capabilities, требуемое подтверждение и источник события.

Четыре n8n workflow найдены в `clawdbot1/automation`; подробности и риски — в [аудите от 27.11.2026](./N8N-WORKFLOW-AUDIT-2026-11-27.md). Таблица ниже сопоставляет задачи с обнаруженной n8n-реализацией.

Наличие строки в каталоге не означает, что task handler уже зарегистрирован или что production workflow использует Harness.

## 1. Message Automation

| task_type (candidate) | Источник / сервис | LLM | Capabilities | Approval |
|---|---|---:|---|---|
| messages.prepare_draft | Content Autopilot, календарь | Нет, если текст готов | calendar.read, telegram.owner_draft.send | Черновик направляется только владельцу |
| messages.approve_draft | Telegram callback | Нет | telegram.approval_callback.consume | Проверить user ID, chat ID и точный message_id |
| messages.smmplanner_handoff | Content Autopilot PR #7 | Нет | telegram.owner_handoff.send | Обязательно до отправки копируемого текста |
| messages.publish_direct | Content Autopilot PR #6 | Нет | social.publish.direct | Запрещено по умолчанию; отдельное решение владельца и тестовые каналы |

PR #6 и PR #7 — разные действия. Не объединять их в универсальный messages.publish: handoff владельцу не равен публикации в социальных каналах.

## 2. CRM Intake

| task_type (candidate) | Источник / сервис | LLM | Capabilities | Approval / policy |
|---|---|---:|---|---|
| crm.receive_lead | n8n workflow-1: Netlify webhook → Apps Script | Нет | netlify.signature.verify (MISSING), crm.lead.validate, sheets.lead.append | Подпись сейчас не проверяется; добавить stable submission ID и идемпотентность |
| crm.notify_owner | n8n workflow-1 | Нет | telegram.owner_notification.send | Сейчас сообщение содержит контакт и свободный текст; заменить на минимальное уведомление без PII |
| crm.remind_overdue | n8n workflow-2, daily 10:00 Europe/Moscow | Нет | sheets.lead.read, telegram.owner_notification.send | Проверить GET-token, ограничить поля ответа, добавить обработку ошибок |

## 3. Sales Engine

| task_type (candidate) | Источник / сервис | LLM | Capabilities | Approval / policy |
|---|---|---:|---|---|
| sales.search_companies | n8n workflow-3, manual + daily 09:00; Outscraper Google Maps | Нет на этапе поиска | web.company_search | Endpoint требует проверки по аккаунту; расписание оставить выключенным до проверки |
| sales.analyze_company | n8n workflow-3, GigaChat | Да, GigaChat | llm.company_analyze | Парсинг свободного текста regex; добавить strict JSON schema и fail-closed validation |
| sales.score_lead | n8n workflow-3 | Смешанный: GigaChat score, Apps Script хранит значение | sales.score.calculate | Диапазон 0–100 пока не валидируется сервером |
| sales.prepare_outreach | n8n workflow-3 → Telegram card | Да, GigaChat draft fields | llm.outreach_draft, sheets.lead.append, telegram.owner_draft.send | Карточка для владельца; отправка компании вручную. Delivery recovery отсутствует |
| sales.approve_lead | n8n workflow-4 callback_query | Нет | telegram.approval_callback.consume, sheets.lead.update, telegram.card.edit | P0: нет проверки approver ID, private chat, message_id и допустимого перехода статуса |

## 4. Capabilities — базовый реестр

Capability определяется по фактическому эффекту. Нельзя выводить право на действие только из task_type, текста промпта или данных внешнего документа.

| Capability | Класс | Default policy |
|---|---|---|
| calendar.read | Read | Разрешать только необходимым message tasks |
| telegram.owner_draft.send | External message | Только утверждённый владелец/чат |
| telegram.owner_notification.send | External message | Минимальные уведомления без PII |
| telegram.approval_callback.consume | Decision input | Проверять actor, chat, message_id, action и текущий state |
| telegram.owner_handoff.send | External message | Approval и operation key обязательны |
| social.publish.direct | High-impact external side effect | Deny by default; отдельное owner opt-in и тестовая среда |
| netlify.signature.verify | Trust boundary | Обязательно до доверия webhook payload |
| crm.lead.validate | Data validation | Consent, form ID, поля и минимизация данных |
| sheets.lead.read / sheets.lead.append / sheets.lead.update | Data access | Ограничивать нужным проектом, таблицей и операцией |
| web.company_search / web.site_read | External read | Ограничивать домены, объём и timeout; считать результаты недоверенными данными |
| llm.company_analyze / llm.outreach_draft / llm.followup_draft | Model invocation | Только зарегистрированным handlers; вызов модели не разрешает внешнюю отправку |

Реестр capability должен храниться в коде/конфигурации Harness и проверяться перед каждым вызовом инструмента. Пользовательский input и ответы LLM не могут расширять список разрешений.

## 5. Что не регистрировать до runtime-подтверждения

Четыре n8n workflow exports уже найдены и статически проверены. Однако не
создавать production runtime handlers и не активировать workflow, пока:
- live n8n version, workflow state and last execution не подтверждены;
- credential names/types не сверены с экспортами;
- Apps Script deployment и Sheet headers не проверены;
- Netlify consent field и policy не утверждены;
- Outscraper API contract не проверен по account docs;
- все P0/P1 checks не пройдены в synthetic test environment.

GigaChat можно оставить отдельным Model Adapter candidate; фактический API
контракт и production credential не подтверждены. Direct social publishing
запрещено по умолчанию без отдельного owner permission и тестового контура.

## 6. Порядок регистрации

Для каждого нового handler обязательны:
1. task_type и версия схемы;
2. input/output schema;
3. источник события и правила доверия;
4. список обязательных capabilities;
5. список auto-execute и approval-required действий;
6. правила качества результата;
7. idempotency key и поведение при unknown outcome;
8. unit/smoke tests и инструкция ручного восстановления.

Первый runtime pilot следует выбирать после проверки live n8n runtime и
разрешения P0 approval/authentication issues. Не нужно повторно запрашивать
у пользователя уже найденные workflow JSON.

## 7. Статус безопасных уведомлений и Intake (2026-11-27)

Все изменения ниже остаются в Draft PR и не означают production rollout.

- [clawdbot1 PR #2](https://github.com/ritarakunova-hub/clawdbot1/pull/2):
  owner ID + private chat + exact Telegram message_id; only allowlisted status
  transitions; message buttons attach only after message ID persistence.
- [clawdbot1 PR #3](https://github.com/ritarakunova-hub/clawdbot1/pull/3),
  stacked on #2: Netlify JWS, consent validation, stable submission ID,
  lock-protected idempotency, PII minimization, POST-only internal API,
  atomic Sales Engine deduplication, score validation 0–100 and fail-closed
  GigaChat response validation.
- CI for PR #3 head `a62394cdf1d60c296e48d6039cff53e24a6fe8a7` passed on
  Node 24 and Node 26: [run #45991719682](https://github.com/ritarakunova-hub/clawdbot1/actions/runs/45991719682).
- Node.js PR #11/#12 in `clawdbot` are old alternatives/reference patterns,
  not the selected n8n implementation; do not merge/deploy as substitutes.
- Harness Task Router/handlers are not implemented or registered yet.
