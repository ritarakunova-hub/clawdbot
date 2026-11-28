# TAINA Agent Harness V1 — Implementation Plan

## Принцип планирования

Сначала устранить реальные риски и договориться о контракте. Не переносить четыре workflow разом и не создавать новый runtime, пока не определены фактические точки интеграции.

## Этап 0 — закрыть аудит (P0)

**Изучено и подтверждено по исходникам:**
- две GitHub-реализации Content Autopilot (PR #6 и PR #7) на уровне исходного кода и документов;
- найдены все четыре выбранных n8n workflow export в `ritarakunova-hub/clawdbot1/automation`, Apps Script, README и синтетический payload;
- проведён статический аудит графов: уникальные node IDs/names, все connection endpoints существуют; все exports остаются `active: false`;
- PR #2/#3 содержат security hardening для owner-only approvals, Netlify JWS/consent, idempotency, PII minimization и валидации Sales Engine. Автотесты на Node 24/26 прошли; production runtime этим не подтверждается.

**Остаётся получить / проверить — только безопасные operational facts:**
- фактическая версия live n8n и импортированы ли в неё эти exports (или более новые версии);
- workflow IDs, active/inactive state, расписание и статусы последних executions;
- имена и типы используемых credentials, без их значений;
- hosting/runtime topology, число реплик, storage, execution retention/pruning и поведение retries;
- URL/версия тестового Apps Script deployment и соответствие заголовков отдельной тестовой Google Sheet;
- наличие отдельного тестового Telegram-бота/чата;
- реальный Outscraper endpoint/параметры/response shape из аккаунта владельца и GigaChat credential/API contract;
- privacy/legal decision, утверждённый текст согласия и unchecked checkbox в форме до подключения реального Netlify intake.

Не запрашивать и не передавать в чат секреты, реальные клиентские данные или полные execution payloads.

**Результат:** подтверждённая карта live/test среды и выбранный пилот. Исходные workflow exports повторно искать или запрашивать не нужно.

## Этап 1 — общий контракт (P0)

1. Утвердить поля Task Request / Task Result из task-contract.schema.json.
2. Добавить runtime-валидацию JSON Schema на границе workflow.
3. Согласовать каталог task_type и версионирование handler.
4. Ввести correlation ID и idempotency key.
5. Определить, где хранится состояние и как делается восстановление.

**Exit criteria:** реальные примеры всех типов задач проходят валидацию; неизвестные task_type и неразрешённые tool calls отклоняются.

## Этап 2 — минимальное ядро (P0)

1. Task Router и Registry.
2. единый error envelope и классификация ошибок;
3. общий вызов GigaChat только для task types, требующих LLM;
4. ограниченные timeout/retry;
5. журнал переходов состояний и метаданные выполнения;
6. общий Tool Gateway.

**Exit criteria:** один пилотный workflow запускается через общую границу Harness, а бизнес-логика остаётся в отдельном обработчике.

## Этап 3 — контроль и защита side effects (P0/P1)

1. Quality Gate для обязательных полей и формата.
2. Permission checks на каждый tool call.
3. Approval ID привязать к точной версии действия и содержимого.
4. Записывать dispatch intent до сетевого side effect.
5. При неоднозначном результате — manual review, без автоматического повтора.
6. Добавить тесты на replay, duplicate callbacks, crash before/after external response.

**Exit criteria:** повторное событие не создаёт повторного критического действия; после имитации сбоя задача восстанавливается в понятный статус.

## Этап 4 — подключение остальных workflow (P1)

Подключать по одному. На каждый workflow — mapping входа/выхода, список tools, permissions, тесты и rollback. Не объединять workflow, если у них различаются бизнес-ответственность или SLA.

## Этап 5 — расширение продуктовых направлений (после V1)

- TAINA Knowledge Map;
- TAINA Sales Engine;
- другие сценарии TAINA AI & Automation.

Нужна отдельная оценка безопасности и структуры данных для каждого продукта.

## Технические решения, которые пока запрещено принимать без фактов

- перенос всех message workflow в один Node.js runtime;
- перенос всех workflow в n8n;
- замена текущего хранилища на PostgreSQL;
- включение direct publishing;
- создание отдельной веб-панели;
- переписывание интеграции Telegram;
- включение LLM в сценарии, которые работают без модели.

## Режим работы и контроль объёма

При доступном времени 5–6 часов в неделю вести по одному изменению за итерацию:
1. короткий design note;
2. изменение в изолированной ветке;
3. unit/smoke tests;
4. ручной сценарий в тестовой среде;
5. решение владельца о переносе в production.

Production, credentials и каналы реальных пользователей не трогать без отдельного разрешения.
