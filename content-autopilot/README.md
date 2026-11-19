# TAINA Content Autopilot

The service prepares a post from the content calendar and sends it to the owner's private Telegram chat. The owner can publish it to the VK community and Telegram channel or cancel it.

## Safe default flow

1. At the configured schedule (default 09:00 Europe/Moscow), the service looks for a post for the current date.
2. If the calendar entry contains only a topic, the bot sends a reminder. It does not publish anything.
3. If the entry contains final copy, the bot sends a draft with two buttons: "Publish now" and "Cancel".
4. By default, publication happens only after the owner explicitly taps "Publish now". Silence is not consent.
5. If one platform fails, the service stores the result per platform. A retry sends only to the destination that has not confirmed publication.

Timed auto-publishing is an optional mode and is disabled by default with AUTO_PUBLISH_ENABLED=false. Do not enable it without a separate owner decision.

## Requirements

- Node.js 20 or newer.
- A Telegram bot that is an administrator in the destination channel with permission to publish.
- A VK community token with permission to publish to the community wall.
- A public HTTPS application URL for the Telegram webhook.

## Environment variables

Set all credentials in local environment variables or in the hosting provider's secret manager. Do not add them to Git.

| Variable | Required | Purpose |
|---|---:|---|
| TELEGRAM_BOT_TOKEN | Yes | Bot token |
| TELEGRAM_CHAT_ID | Yes | Private chat for drafts and approvals |
| TELEGRAM_CHANNEL_ID | Yes | Telegram destination channel |
| TELEGRAM_WEBHOOK_SECRET | Yes | Verify incoming Telegram webhooks |
| VK_GROUP_ID | Yes | Numeric VK community ID |
| VK_COMMUNITY_TOKEN | Yes | VK community access token |
| INTERNAL_API_SECRET | Yes | Protect manual /check/now trigger |
| TIMEZONE | No | Defaults to Europe/Moscow |
| CRON_SCHEDULE | No | Defaults to 0 9 * * * |
| APPROVAL_WINDOW_MINUTES | No | Used only if timed publishing is explicitly enabled |
| AUTO_PUBLISH_ENABLED | No | Defaults to false |
| PORT | No | Defaults to 3000 |

Generate two separate strong random values for TELEGRAM_WEBHOOK_SECRET and INTERNAL_API_SECRET. Do not reuse one secret for both purposes.

## Telegram setup

1. Add the bot to the TAINA channel as an administrator with permission to publish messages.
2. Set the owner's private chat ID as TELEGRAM_CHAT_ID and the channel ID as TELEGRAM_CHANNEL_ID.
3. After deployment, configure the webhook:

    curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
      -d "url=https://YOUR-AMVERA-APP/telegram/webhook" \
      -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"

Check the Telegram API response and confirm that ok is true. Never paste a bot token into a public issue, code file or chat.

## Protected manual trigger

The /check/now endpoint requires a separate bearer secret:

    curl -X POST "https://YOUR-AMVERA-APP/check/now" \
      -H "Authorization: Bearer $INTERNAL_API_SECRET"

If INTERNAL_API_SECRET is missing, the endpoint returns 503. An incorrect secret returns 401.

## Content calendar

The file content-autopilot/data/posts.json contains entries with date, rubric, title and type:
- full: final copy sent as a draft for approval;
- topic: a reminder only; no post is published.

The calendar is validated when loaded. Dates must be real and unique. Each entry needs a title and rubric, and every full entry must contain text.

## Pending state and retries

The current pending draft is persisted in data/pending.json using an atomic file replacement. If Telegram confirms publication but VK fails, the state records the successful Telegram destination. A retry does not deliberately send the Telegram post again.

A network interruption can happen after a platform accepts a post but before the service receives the response. In that rare case, check the destination manually before retrying, to avoid a duplicate.

## Local verification

    npm ci
    npm test
    node --check index.js

Tests do not send real messages to Telegram or VK. They cover the calendar, validation, manual approval default, callback data, state persistence, and partial retry behavior.

Deployment and publishing to the real social accounts are not performed by this repository change.
