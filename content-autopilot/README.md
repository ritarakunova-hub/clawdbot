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
- Only the configured owner in the private Telegram chat can approve or cancel.
- Telegram webhook requests require TELEGRAM_WEBHOOK_SECRET.
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
| TELEGRAM_WEBHOOK_SECRET | Yes | Telegram webhook verification secret |
| INTERNAL_API_SECRET | Yes | Bearer secret for /check/now |
| TIMEZONE | No | Defaults to Europe/Moscow |
| CRON_SCHEDULE | No | Defaults to 0 9 * * * |
| PENDING_FILE | Yes in production | JSON state file on the persistent volume |
| PORT | Platform-defined | HTTP server port |

Do not add SMMplanner login credentials, VK tokens, or Telegram channel credentials to this service. Direct publishing has been removed.