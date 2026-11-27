# TAINA n8n workflows — security and runtime audit

**Date:** 2026-11-27  
**Source:** `ritarakunova-hub/clawdbot1`, branch `claude/eager-ptolemy-ktb3lq`, source commit `730f6a664e8d9c3b82d8536bdbd86093a42be270`.  
**Audit mode:** static review of four exported n8n workflow JSON files, Apps Script and operator README. No live n8n instance, credential values, Google Sheet or Telegram bot was accessed.

## 1. Executive result

The four missing workflow exports were found in the `clawdbot1` repository. They are the selected architecture documented by that repository's `automation/README.md`; it explicitly says the Node.js `mini-crm/` and `sales-engine/` folders in the website repository are an old, unused variant and must not be deployed to Amvera.

All four JSON exports have `active: false`. They contain setup placeholders for webhook path, Apps Script URL/token, Telegram chat/credentials and Outscraper API key. The README says n8n is deployed on Amvera and a GigaChat credential exists, but those are instructions/claims in the repo and were not verified against a live instance. Do not infer production state from the exports.

**Conclusion:** use these four n8n workflows and Apps Script as the current implementation baseline. Treat Node.js mini-CRM / Sales Engine branches in `clawdbot` as an alternative legacy implementation and code-reference only until a deliberate migration decision is made.

## 2. Workflow map

| File | Trigger | Main path | External effects | Export status |
|---|---|---|---|---|
| `mini-crm/workflow-1-new-lead.json` | Netlify POST webhook | Normalize fields → Apps Script append → branch to Telegram success/error | Writes contact data to Google Sheet; sends Telegram message | Inactive; placeholders |
| `mini-crm/workflow-2-reminders.json` | Daily 10:00, `Europe/Moscow` | Apps Script `overdue` → check count → format → Telegram | Reads leads and sends owner reminder | Inactive; placeholders |
| `sales-engine/workflow-3-lead-finder.json` | Manual and daily 09:00 | Outscraper → normalize companies → loop → dedupe check → GigaChat → Apps Script append → Telegram card | Outscraper request, GigaChat request, Sheet append, owner Telegram card | Inactive; placeholders |
| `sales-engine/workflow-4-approval-handler.json` | Telegram `callback_query` | Parse callback → Apps Script status update → edit Telegram card | Changes CRM status and edits original Telegram message | Inactive; placeholders |

The shared data store is the Google Sheet “TAINA — Воронка” through one Apps Script Web App. Credentials are referenced by n8n credential bindings; exports do not supply live credential values.

## 3. Findings — order by risk

### P0 — approval callback has no actor authorization

Workflow 4 parses `callback_query.data` into `action:id`, then maps only the literal `approve` to “Одобрено”; every other value becomes “Отклонено”. It does not verify:
- `callback_query.from.id` against an explicitly configured owner/approver;
- `callback_query.message.chat.id` against the private owner chat;
- `callback_query.message.message_id` against the Telegram card originally issued for this lead;
- that the action is exactly `approve` or `reject`;
- that the lead currently has a state from which this transition is allowed.

Apps Script `updateStatus(id, status)` accepts any non-empty status and writes it to the row. Its token check authenticates the workflow, not the Telegram person who clicked the button. Anyone able to produce a callback event accepted by this bot/workflow may attempt a status change. The flow also doesn't acknowledge callback queries, so Telegram clients may keep showing a spinner.

**Required fix:** reject unknown actions and malformed/non-numeric IDs; validate callback actor and chat; bind callback to the exact stored Telegram message ID; enforce allowed state transitions server-side in Apps Script; acknowledge callback queries on success and rejection. Never rely on a hidden button or an opaque row ID as authorization.

### P0 — public intake webhook has no request authentication

Workflow 1's Webhook node has no authentication configured. A random path placeholder is suggested as an extra obstacle, but that is not sender authentication. The workflow accepts a JSON body and forwards it to Apps Script with a shared token after the request has already passed the public n8n endpoint.

The old Node.js implementation contains a Netlify JWS verification pattern, but it is not present in this n8n workflow.

**Required fix:** verify Netlify's signed webhook against the exact raw body before normalization or persistence, or use another supported sender-authentication mechanism. A random endpoint path is not a substitute for signature verification. Keep the endpoint disabled until verified.

### P1 — personal data is sent to Telegram

Workflow 1 formats the Telegram notification with name, company, contact channel and free-text message. The Apps Script `getOverdue()` response also includes the contact field even though workflow 2's text builder currently omits it.

**Required fix:** minimize Telegram to submission/lead ID, form, timestamp and a neutral status. Keep name, phone, email and free text inside the approved CRM storage. Avoid returning contact fields from the overdue endpoint when the reminder does not need them. Review data-retention and access permissions before processing real leads.

### P1 — credentials are sent in GET query strings

Workflows 2–4 call Apps Script `doGet` with `token=...` in query parameters for overdue lookup, duplicate checks and status updates. Query strings are more likely to be captured in execution histories, request logs and diagnostics than a request body. The token is a bearer secret: anyone obtaining it can invoke read/update operations.

**Required fix:** move state-changing and read operations to POST request bodies, restrict allowed actions, rotate the shared token before production and limit stored execution data. Keep legacy GET routes disabled or compatibility-only after migration. Do not put tokens in webhook URLs.

### P1 — no stable intake idempotency and no atomic row allocation

Workflow 1 does not pass Netlify's stable submission ID to Apps Script. `addNetlifyLead()` assigns `ID = sheet.getLastRow()` and appends a row. Re-delivery of the same Netlify event can create a duplicate.

Sales Engine checks `checkExists(company, site)` before writing, but the check and append are separate operations. Concurrent manual/scheduled runs can both see “not found” and append duplicates. Apps Script does not use `LockService` around ID allocation or append.

**Required fix:** preserve Netlify `payload.id` as a unique submission key; deduplicate within an Apps Script lock around lookup + append. Apply an atomic normalized company/site claim or a lock-protected check-and-append for Sales Engine. Do not treat a preflight GET as an atomic uniqueness guarantee.

### P1 — Sales Engine can leave orphaned review cards

Workflow 3 writes a lead to the sheet before sending its Telegram card. The Telegram send node has no explicit error output or manual-recovery path. If Telegram delivery fails after the Sheet append, the company is now a duplicate on the next run and is skipped; the owner may never receive a review card.

**Required fix:** use a delivery state machine and store the exact Telegram `message_id`. Send a card without inline buttons, persist the message ID and ready state, then attach buttons. An ambiguous send outcome must transition to manual review rather than trigger a blind resend. Add a protected operator recovery action.

### P1 — GigaChat response parsing was not schema-safe in the source baseline

В исходном экспорте GigaChat возвращал текстовый шаблон, а workflow извлекал поля регулярными выражениями без полной проверки обязательных значений и границ score. Просьба к модели соблюдать формат сама по себе не являлась runtime-валидацией.

**Подготовленное исправление в Draft PR #3:** перед записью теперь проверяются целый score 0–100, обязательные факты/объяснение/гипотеза/решение/зацепка и лимиты длины. Неполный или некорректный ответ отклоняется, лид не создаётся, владельцу уходит уведомление. Внешние поля Outscraper ограничиваются по длине; телефон не передаётся в GigaChat; prompt запрещает исполнять инструкции, спрятанные во внешних данных. Timeout: Outscraper 30 секунд, GigaChat 45 секунд.

**Что ещё не идеально:** ответ остаётся валидируемым текстовым шаблоном, а не формальным JSON Schema / provider-enforced JSON mode. Это последующее улучшение после runtime-проверки.

### P1 — Apps Script update endpoint accepts arbitrary status values

`updateStatus()` writes any non-empty status and doesn't enforce a finite list or state transition. The callback parser's “anything other than approve means reject” makes this broader than intended.

**Required fix:** allow only exact approved actions mapped to exact statuses; reject unknown states and invalid IDs; enforce a transition matrix (e.g. only “На рассмотрении” → “Одобрено” / “Отклонено”).

### P2 — external API and workflow runtime assumptions are not verified

The README itself warns that the Outscraper endpoint/parameters and response shape were not verified against the account's current API docs. The export also contains a sticky-note reminder to verify Loop Over Items output wiring after import. The JSON contains an explicit daily trigger in workflow 3; it should remain disabled until cost/rate limits and desired cadence are confirmed.

**Required fix:** run one low-cost Outscraper request using the current account docs, validate the actual result shape and loop behavior in a test workflow, and only then enable a limited schedule. No recurring search should be activated by default.

## 4. Apps Script observations — initial source baseline

The following observations describe the original source export before PR #2/#3 changes:
- stores its shared token in Script Properties and compares exact values;
- supports POST for lead creation, but GET for overdue lookup, duplicate checks and status updates;
- uses the first sheet in the spreadsheet;
- allocates IDs using `getLastRow()` and uses `appendRow()` without a script lock;
- returns contact data from `getOverdue()`;
- checks duplicates by normalized company/site but not atomically with insert;
- has no submission ID field for Netlify deduplication;
- writes arbitrary status values.

The original token check was fail-closed when the property was absent. It did not, however, replace per-user approval authorization or server-side input/state validation.

**Mitigations in Draft PR #2/#3:** GET is disabled; internal operations use POST bodies; Telegram actor/chat/card identity and state transitions are enforced server-side; Netlify JWS and consent are checked before parsing/storing; Netlify and Sales Engine dedupe are protected with LockService; external text/score are validated before write; overdue lookup omits contact fields.

## 5. Suggested remediation order

1. **Approval security first:** owner ID + private chat + action/id validation + server-side transition allowlist + callback acknowledgement.
2. **Intake security and privacy:** Netlify JWS verification, stable submission ID, remove PII from Telegram, limit Apps Script response fields.
3. **Storage correctness:** LockService, idempotent intake, atomic Sales Engine dedupe and safe IDs.
4. **Telegram delivery reliability:** message_id persistence, review-card state machine and manual recovery.
5. **LLM validation:** structured JSON schema and fail-closed invalid response handling.
6. **Operational validation:** Outscraper live-account request, workflow import test, timezone and credential binding review, test dataset, then controlled enablement.

## 6. Source-of-truth and deployment boundary

- The n8n exports and Apps Script are the current documented architecture in `clawdbot1/automation`.
- The README for that branch explicitly supersedes the Node.js mini-CRM/Sales Engine folders in `clawdbot`; do not deploy those Node variants as the live automation.
- Node.js PR #11/#12 in `clawdbot` may contain reusable safety patterns, but they are not a replacement for hardening the chosen n8n workflows.
- All four n8n workflow exports are inactive and use placeholders. This audit does not activate, import or change a live n8n instance.
- Live runtime state, credential bindings, Google Sheet contents, Apps Script deployment version, Netlify webhook and production status remain unverified.

## 7. Files audited

- `automation/mini-crm/workflow-1-new-lead.json`
- `automation/mini-crm/workflow-2-reminders.json`
- `automation/sales-engine/workflow-3-lead-finder.json`
- `automation/sales-engine/workflow-4-approval-handler.json`
- `automation/apps-script/Code.gs`
- `automation/README.md`
- `automation/test/test.md`


## 8. Remediation status as of 2026-11-27

The following implementation work exists in separate Draft PRs in
`ritarakunova-hub/clawdbot1`:

- **PR #2 — approval authority and message binding:** validates Telegram owner,
  private chat, action and exact originating `message_id`; persists card ID
  before adding buttons; restricts status transitions. Automated tests cover
  unauthorized owner, group chat, stale message and contradictory decision.
- **PR #3 — signed intake and duplicate safety:** verifies Netlify JWS before
  parsing raw body; enforces consent and field limits; rejects legacy unsigned
  intake; stores stable submission ID; uses LockService around duplicate
  lookup + append; moves Apps Script internal calls from GET to POST; removes
  contact details from Telegram reminders; validates Sales Engine score and
  GigaChat output before appending; uses server-side atomic company/site
  deduplication; bounds untrusted Outscraper fields; excludes phone/contact
  from GigaChat; rejects prompt-injection instructions embedded in source data;
  and adds 30s/45s timeouts for Outscraper/GigaChat; Apps Script also compares
  the internal bearer token using a constant-time helper and rejects malformed
  or overlong values.
- Latest PR #3 head `2112feed753f0f86df44c21bad9eb19d530183be` passed
  Node 24 and Node 26, including Apps Script auth/approval regression tests,
  signed intake, deduplication, GigaChat validation/prompt-injection/timeouts,
  sample sender syntax, and JSON parsing for all four exports:
  [push CI #45993318100](https://github.com/ritarakunova-hub/clawdbot1/actions/runs/45993318100)
  and [PR CI #45993325185](https://github.com/ritarakunova-hub/clawdbot1/actions/runs/45993325185).

### Remaining blockers

1. Live n8n version, imported workflow IDs/active flags, execution state and
   credential names/types are not yet confirmed.
2. Apps Script Web App deployment and Sheet schema must be checked against the
   new headers in a test copy.
3. Current site HTML has no explicit consent checkbox/policy link. Real form
   submissions must remain disconnected until reviewed consent text and
   policy are approved and the required unchecked checkbox is added.
4. Outscraper endpoint/response shape still requires one low-cost test against
   the owner's account documentation.
5. Telegram card failure after successful send but before message-ID
   persistence still requires manual operator reconciliation. Do not blindly
   retry.
6. GigaChat uses a validated text template rather than a formal JSON Schema /
   provider-enforced JSON mode. Missing/invalid fields now fail closed; a
   structured JSON response schema remains a future robustness improvement.
7. The shared `WEBHOOK_TOKEN` is sent in internal POST bodies because Apps
   Script Web Apps do not expose arbitrary request headers. Review n8n execution
   data retention/pruning and restrict execution-history access; never export
   actual executions with resolved tokens or real lead data.

All four workflows in the source export remain inactive/placeholders. No
workflow import, activation, webhook registration, Apps Script deployment,
live Sheet mutation, production credential change or outbound message was
performed. The PRs are Draft and must be reviewed and tested in a disposable
environment before any production decision.
