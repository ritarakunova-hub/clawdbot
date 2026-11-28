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
| crm.receive_lead | n8n workflow-1 → Apps Script | Нет | netlify.signature.verify, crm.lead.validate, sheets.lead.append | Draft PR #3 добавляет JWS verification, consent gate, stable/formula-safe submission key (unsafe IDs fall back to verified-body SHA-256) и lock-protected deduplication; live intake disabled |
| crm.notify_owner | n8n workflow-1 | Нет | telegram.owner_notification.send | Draft PR #3 удаляет name/contact/free text из Telegram; уведомление только ID/form/time |
| crm.remind_overdue | n8n workflow-2, daily 10:00 Europe/Moscow | Нет | sheets.lead.read, telegram.owner_notification.send | Draft PR #3 переносит вызов на POST и убирает контакт из response; workflow проверяет `ok/count/items` и отправляет PII-free alert при transport/contract errors; live runtime всё ещё требует сверки |

## 3. Sales Engine

| task_type (candidate) | Источник / сервис | LLM | Capabilities | Approval / policy |
|---|---|---:|---|---|
| sales.search_companies | n8n workflow-3, manual + daily 09:00; Outscraper Google Maps | Нет на этапе поиска | web.company_search | Endpoint/schema требуют проверки по account docs; schedule остаётся выключенным до live verification; HTTP timeout 30s |
| sales.analyze_company | n8n workflow-3, GigaChat | Да, GigaChat | llm.company_analyze | Draft PR #3 валидирует обязательные поля и score; untrusted Outscraper data не считается инструкциями; телефон не передаётся модели; timeout 45s |
| sales.score_lead | n8n workflow-3 + Apps Script | Да | sales.score.calculate | Apps Script принимает только целое 0–100; malformed/missing score не создаёт лид |
| sales.prepare_outreach | n8n workflow-3 → Telegram card | Да, GigaChat draft fields | llm.outreach_draft, sheets.lead.append, telegram.owner_draft.send | Draft PR #2/#3 сохраняют message_id до появления кнопок, атомарно дедуплицируют компанию/сайт; внешнее сообщение отправляет человек |
| sales.approve_lead | n8n workflow-4 callback_query | Нет | telegram.approval_callback.consume, sheets.lead.update, telegram.card.edit | Draft PR #2 проверяет owner ID, private chat, exact message_id и допустимый переход статуса |

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
  owner ID + private chat + exact Telegram message_id; allowlisted status
  transitions; card ID persistence before attaching buttons.
- [clawdbot1 PR #3](https://github.com/ritarakunova-hub/clawdbot1/pull/3),
  stacked on #2: Netlify JWS and consent gate; formula-safe submission key with
  deterministic SHA-256 fallback; LockService idempotency; PII minimization;
  POST-only API; atomic Sales Engine dedupe; score validation; bounded external
  fields; GigaChat prompt-injection guard; 30s/45s timeouts; constant-time
  internal token comparison; validated reminder response + failure alert.
- Latest CI for the current PR #3 head `cde248dfcebaf767d3810e3fb6684c20a699f7fd` passed:
  [push #46106188475](https://github.com/ritarakunova-hub/clawdbot1/actions/runs/46105743519)
  and [PR #46106193083](https://github.com/ritarakunova-hub/clawdbot1/actions/runs/46105750631).
  Both Node 24/26 jobs passed Apps Script security/regressions, strict numeric
  score validation, malformed Outscraper filtering, prompt-injection checks,
  all-workflow HTTP timeout checks, graph integrity (unique IDs/names, valid
  edges, inactive exports), sample-sender syntax, all four workflow JSON parses, the manual-runbook check that aligns the documented GET rejection code with Apps Script, unsafe Netlify ID fallback/retry deduplication, and the workflow-2 response validation/error route.
- Node.js PR #11/#12 in `clawdbot` are legacy/reference variants, not the
  selected n8n implementation; do not merge/deploy as substitutes.
- Harness Task Router/handlers are not implemented or registered yet.
