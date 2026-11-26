# TAINA Agent Harness V1 — предварительный каталог задач

**Статус:** Draft / derived from source-code review  
**Назначение:** карта кандидатов для Task Registry, не утверждение о подключении этих сервисов к Harness.

Каталог отделяет бизнес-задачу, необходимость LLM, инструменты и внешние эффекты, capabilities, требуемое подтверждение и источник события.

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
| crm.receive_signed_lead | Подписанный Netlify webhook, mini-CRM | Нет | netlify.signature.verify, crm.lead.validate, sheets.lead.append | Проверять согласие и правила обработки; до privacy review использовать только синтетические данные |
| crm.notify_owner | mini-CRM | Нет | telegram.owner_notification.send | Только минимальное уведомление; не передавать PII и свободный текст заявки в Telegram |

Для CRM важны не только permissions, но и policy constraints: минимизация персональных данных, consent, условия хранения, сроки, доступ и удаление.

## 3. Sales Engine

| task_type (candidate) | Источник / сервис | LLM | Capabilities | Approval |
|---|---|---:|---|---|
| sales.search_companies | Защищённая web-форма / Sales Engine | Да, в текущей реализации поиск строится на Claude | web.company_search | Не отправляет сообщения потенциальным клиентам |
| sales.analyze_company | Sales Engine | Да, Claude | web.site_read, llm.company_analyze | Проверять факты и гипотезы |
| sales.score_lead | Sales Engine | Смешанный: критерии от LLM, итоговая формула в коде | sales.score.calculate | Проверяемая детерминированная формула |
| sales.prepare_outreach | Sales Engine | Да, Claude | llm.outreach_draft, sheets.lead.update, telegram.owner_draft.send | Обязательное одобрение; фактическую отправку адресату выполняет человек |
| sales.prepare_followup | Sales Engine cron | Да, Claude | sheets.lead.read, llm.followup_draft, sheets.lead.update, telegram.owner_draft.send | Обязательное одобрение до внешнего контакта |

В исходном Sales Engine README зафиксировано, что этот сервис использует Node.js и Claude/Anthropic и не является n8n/GigaChat-пайплайном. Это характеристика просмотренной ветки, не доказательство отсутствия других production-интеграций.

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

## 5. Что не регистрировать до получения подтверждений

Не создавать runtime handlers для:
- четырёх заявленных n8n workflow, пока нет их экспортов;
- GigaChat, пока не подтверждены реальный API контракт, используемая модель и фактическая точка вызова;
- Sales Engine и mini-CRM, пока не подтверждены их production status, privacy policy и владелец внешних таблиц/ботов;
- direct social publishing без отдельного разрешения и тестового контура.

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

Первый runtime pilot следует выбирать после получения четырёх n8n exports и подтверждения фактически активной message automation.
