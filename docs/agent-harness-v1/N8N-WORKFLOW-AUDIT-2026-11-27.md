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

### P1 — GigaChat response parsing is not schema-safe

The workflow asks GigaChat for a text template and extracts fields with regular expressions. The score parser strips every non-digit; e.g. malformed content can become a value outside 0–100. Required fields can be empty and are still sent to the sheet/card. The prompt requests a strict format, but that is not runtime validation.

**Required fix:** request/parse structured JSON, validate with explicit schema (score integer 0–100; bounded text lengths; required company and reason; source facts separated from hypotheses). If parsing or validation fails, quarantine the company and notify the owner rather than append a malformed record. Treat Outscraper-supplied fields as untrusted input, not instructions.

### P1 — Apps Script update endpoint accepts arbitrary status values

`updateStatus()` writes any non-empty status and doesn't enforce a finite list or state transition. The callback parser's “anything other than approve means reject” makes this broader than intended.

**Required fix:** allow only exact approved actions mapped to exact statuses; reject unknown states and invalid IDs; enforce a transition matrix (e.g. only “На рассмотрении” → “Одобрено” / “Отклонено”).

### P2 — external API and workflow runtime assumptions are not verified

The README itself warns that the Outscraper endpoint/parameters and response shape were not verified against the account's current API docs. The export also contains a sticky-note reminder to verify Loop Over Items output wiring after import. The JSON contains an explicit daily trigger in workflow 3; it should remain disabled until cost/rate limits and desired cadence are confirmed.

**Required fix:** run one low-cost Outscraper request using the current account docs, validate the actual result shape and loop behavior in a test workflow, and only then enable a limited schedule. No recurring search should be activated by default.

## 4. Apps Script observations

The shared `Code.gs` currently:
- stores its shared token in Script Properties and compares exact values;
- supports POST for lead creation, but GET for overdue lookup, duplicate checks and status updates;
- uses the first sheet in the spreadsheet;
- allocates IDs using `getLastRow()` and uses `appendRow()` without a script lock;
- returns contact data from `getOverdue()`;
- checks duplicates by normalized company/site but not atomically with insert;
- has no submission ID field for Netlify deduplication;
- writes arbitrary status values.

The script's token check is fail-closed when the property is absent, which is good. It does not, however, replace per-user approval authorization or server-side input/state validation.

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
