# TAINA Content Review → SMMplanner

This service prepares TAINA posts from the content calendar, sends each draft to the owner's private Telegram chat, and hands approved copy back to the owner for placement in SMMplanner.

**SMMplanner is the only publishing scheduler.** This app does not publish directly to VK or Telegram channels and does not store channel credentials.

## Workflow

1. At the configured schedule (default 09:00 Europe/Moscow), the service looks for a calendar entry for the current date.
2. If the entry contains final copy, the bot sends a review draft to the owner's private Telegram chat.
3. The owner chooses:
   - **Approve for SMMplanner** — the bot sends a separate, copy-ready message containing the approved post, target platforms (Telegram + VK), the planned date, and a link to SMMplanner.
   - **Cancel** — the draft is marked as cancelled and is not handed off.
4. The owner places the approved text in SMMplanner, selects the Telegram and VK pages, and sets the desired publication time.
5. SMMplanner handles scheduling and publication.

If a calendar entry contains only a topic, the bot sends a reminder; nothing is handed to SMMplanner.

## Why the handoff is manual

The public SMMplanner materials document scheduled posting to Telegram and VK, but we did not find an official public developer API for creating scheduled posts from this app. A third-party review updated in September 2026 also reports that no public publication API is available. Therefore this integration deliberately uses a safe copy-ready handoff. It does not call undocumented private endpoints, automate the SMMplanner website, or keep VK/Telegram channel tokens.

If SMMplanner provides an official API or a supported import format, a dedicated adapter can be added later without changing the content calendar or approval logic.

## Safety and state

- The bot's default workflow is review → explicit approval → copy-ready handoff.
- No button triggers direct publication to social channels.
- Approval requires the configured numeric TELEGRAM_APPROVER_ID, the configured private TELEGRAM_CHAT_ID and the exact Telegram message_id saved for the draft. A button copied to another message is rejected.
- Telegram webhook requests require TELEGRAM_WEBHOOK_SECRET.
- Every Telegram API request has a 15-second timeout. Transport errors are sanitized so the bot token in the API URL is not copied into application errors.
- Before sending approved copy to the owner, the service persists handoff_dispatching. If the request times out or the process restarts before confirmation, the operation becomes needs_review and is never retried automatically.
- Draft creation is also persisted as creating_draft before the send. An ambiguous send result becomes needs_review instead of deleting the state and silently creating another draft.
- Topic reminders are persisted as topic_reminder_dispatching before delivery; an ambiguous result also moves to needs_review, preventing duplicate reminders.
- /check/now requires a separate bearer secret (INTERNAL_API_SECRET).
- Approved, cancelled and topic-reminder entries are marked for their calendar date so repeated checks do not create duplicate handoffs.
- Pending state is written atomically.
- One app instance is required: the JSON state store has no distributed lock.
- Production state must live on a persistent writable volume.

## Schedule and deployment

The service checks the current date using TIMEZONE (default Europe/Moscow) and runs on CRON_SCHEDULE (default 0 9 * * *).

See DEPLOYMENT.md for Docker and native Node.js setup.

## Environment

| Variable | Required | Purpose |
|---|---:|---|
| TELEGRAM_BOT_TOKEN | Yes | Bot token for private review messages |
| TELEGRAM_CHAT_ID | Yes | Owner's private one-to-one chat ID |
| TELEGRAM_APPROVER_ID | Yes | Numeric Telegram user ID allowed to approve; separate from the chat setting |
| TELEGRAM_WEBHOOK_SECRET | Yes | Telegram webhook verification secret |
| INTERNAL_API_SECRET | Yes | Bearer secret for /check/now |
| TIMEZONE | No | Defaults to Europe/Moscow |
| CRON_SCHEDULE | No | Defaults to 0 9 * * * |
| PENDING_FILE | Yes in production | JSON state file on the persistent volume |
| PORT | Platform-defined | HTTP server port |

## Manual recovery after an ambiguous Telegram result

A record with status `needs_review` is intentionally blocked from approval/retry. Check the private Telegram chat and the SMMplanner handoff manually first. Do not delete the state file or press a stale button to force another send. Record the verified outcome, then resolve the pending record through an explicit, reviewed operational procedure.

The states `creating_draft` and `handoff_dispatching` mean an external send may have started. On process restart they are converted to `needs_review`; no send is replayed.

Do not add SMMplanner login credentials, VK tokens, or Telegram channel credentials to this service. Direct publishing has been removed.