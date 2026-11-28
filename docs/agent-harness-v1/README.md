# TAINA Agent Harness V1

**Статус:** архитектурная основа / Draft  
**Дата фиксации:** 2026-11-26  
**Владелец:** TAINA AI & Automation

## Назначение

TAINA Agent Harness — повторно используемый контрольный слой для выполнения AI-задач. Это не отдельный агент и не CRM. Он задаёт единые правила приёма задач, передачи контекста, вызова моделей и инструментов, проверки результата, согласования действий и журналирования.

Harness должен отделять **общие механизмы исполнения** от **бизнес-логики конкретного продукта**.

## Принцип реализации

1. Не переписывать существующие workflow ради архитектурной чистоты.
2. Сначала подтвердить фактическую конфигурацию и пути выполнения.
3. Вводить общий контракт и проверки небольшими шагами.
4. Не подключать LLM там, где сценарий детерминирован и модель не нужна.
5. Любое внешнее действие выполнять только при наличии явного разрешения.
6. Не повторять неоднозначное внешнее действие вслепую.
7. Не менять production без отдельного разрешения владельца.

## Что подтверждено предварительным GitHub-аудитом

В репозитории ritarakunova-hub/clawdbot найдены две разные реализации TAINA Content Autopilot:

- [PR #6 — Content Autopilot с прямой публикацией после подтверждения](https://github.com/ritarakunova-hub/clawdbot/pull/6). В этой реализации бот отправляет контент в VK и Telegram после ручного подтверждения.
- [PR #7 — Content Review → SMMplanner](https://github.com/ritarakunova-hub/clawdbot/pull/7). В этой реализации бот отправляет черновик владельцу, после согласования возвращает готовый текст для ручного размещения в SMMplanner. Прямой публикации из сервиса нет.

Это разные модели бизнес-процесса. Их нельзя смешивать под одним общим разрешением «публикация». Для них должны существовать разные capability/permission-наборы.

Подробные наблюдения, ограничения и замечания к коду — в [AUDIT-2026-11-26.md](./AUDIT-2026-11-26.md).

## Состав V1

- единый контракт задачи и результата;
- маршрутизация по типу задачи;
- нормализация и валидация входа;
- сбор контекста с происхождением данных;
- адаптер модели (GigaChat — первый кандидат, если сценарий действительно требует LLM);
- реестр инструментов и разрешений;
- проверки результата;
- согласование внешних и необратимых действий;
- учёт идемпотентности и неоднозначных исходов;
- журнал исполнения без секретов;
- тестовые сценарии и инструкция подключения workflow.

## Границы V1

Не входят: автономная мультиагентность, динамическая выдача агентам новых прав, автоматический выбор множества моделей, отдельная CRM, обязательная новая БД, веб-панель управления и автоматическое изменение production.

## Документы

- [Архитектура](./ARCHITECTURE.md)
- [Аудит текущих реализаций](./AUDIT-2026-11-26.md)
- [Аудит четырёх n8n workflow](./N8N-WORKFLOW-AUDIT-2026-11-27.md)
- [JSON Schema контракта](./task-contract.schema.json)
- [План реализации](./IMPLEMENTATION-PLAN.md)
- [План приёмочных тестов](./TEST-PLAN.md)
- [Предварительный каталог задач и permissions](./TASK-CATALOG.md)
- [Чек-лист безопасной передачи n8n exports](./N8N-AUDIT-INPUT.md)

## Статус аудита n8n на 2026-11-27

Все четыре JSON-экспорта найдены в `ritarakunova-hub/clawdbot1`,
ветка `claude/eager-ptolemy-ktb3lq`, вместе с Apps Script, README и
тестовым payload. Статический аудит: [N8N-WORKFLOW-AUDIT-2026-11-27.md](./N8N-WORKFLOW-AUDIT-2026-11-27.md).

**Текущая реализация находится в Draft PR в исходном репозитории:**
- [clawdbot1 PR #2](https://github.com/ritarakunova-hub/clawdbot1/pull/2) —
  owner-only Telegram approvals, привязка к точной карточке, state validation.
- [clawdbot1 PR #3](https://github.com/ritarakunova-hub/clawdbot1/pull/3) —
  Netlify JWS, consent gate, idempotency, атомарная дедупликация, PII
  minimization, POST-only Apps Script operations, GigaChat output validation.

Latest CI for the current PR #3 head `6d8458d549cdbcbe07ed4cac142303a7d95e382d` passed:
[push #46104678348](https://github.com/ritarakunova-hub/clawdbot1/actions/runs/46104678348)
and [PR #46104681298](https://github.com/ritarakunova-hub/clawdbot1/actions/runs/46104681298).
Node 24/26 passed Apps Script security/regressions, strict numeric score
validation, malformed Outscraper filtering, prompt-injection checks, HTTP
timeouts across four workflows (30s Outscraper / 45s GigaChat), workflow graph
integrity (unique nodes, valid edges, inactive exports), sender syntax and
workflow JSON parsing. Both PRs remain Draft and are not deployed.

**Остаётся проверить live runtime:** версия n8n, фактический список и
active/inactive state workflow, последние executions, credential names/types,
Apps Script deployment, Sheet headers, Netlify webhook and Outscraper account
API. Внутренний `WEBHOOK_TOKEN` передаётся в POST body; ограничьте доступ
к n8n execution history, настройте pruning/retention и не экспортируйте
execution data с подставленным токеном или реальными заявками. Экспорты в
Git имеют `active: false` и placeholders, поэтому production-поведение не
подтверждено.

Ветка `clawdbot1/main` не содержит `automation/`; n8n source находится
именно в feature-ветке `claude/eager-ptolemy-ktb3lq`. Не путать её с
default branch.

Отдельные Node.js PR #11/#12 в репозитории `clawdbot` — legacy/reference
варианты mini-CRM/Sales Engine и не должны развёртываться как замена выбранным
n8n workflow. PR #10 — отдельная self-contained Content Autopilot/SMMplanner
handoff-автоматизация, открытая для code review: unit/safety, HTTP smoke,
npm audit и Docker CI прошли на head `0449e985c4cae3fbecf9a0ecec8620e7556c06be`
([push](https://github.com/ritarakunova-hub/clawdbot/actions/runs/46105157324),
[PR](https://github.com/ritarakunova-hub/clawdbot/actions/runs/46105161563)).
Approvals reject non-private Telegram chats and non-positive/group chat IDs.
The Netlify preview for `exquisite-genie-ec7145` still fails; its deploy
log must be inspected in the owner's Netlify account. A separate preview for
`dazzling-jelly-106859` is now ready at
[deploy-preview-10--dazzling-jelly-106859.netlify.app](https://deploy-preview-10--dazzling-jelly-106859.netlify.app).
This does not clear the failing project check or authorize production promotion.
PR #10 does not perform direct social publishing and is not an Amvera production rollout.

**Блокер реальных заявок:** проверенная форма
`clawdbot/taina-site/index.html` пока не содержит явного consent checkbox
и ссылки на утверждённую privacy policy. Пока юридические условия и текст
согласия не утверждены и checkbox не добавлен, workflow-1 отклонит реальные
заявки без `consent=yes`. Это намеренный fail-closed режим.
