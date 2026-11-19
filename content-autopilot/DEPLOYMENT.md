# TAINA Content Autopilot — deployment guide

This service is not tied to Amvera or another specific cloud provider. The repository includes a Dockerfile and can also run as a native Node.js service.

## The host must support

- A continuously running web process (the built-in cron scheduler runs inside it).
- A public HTTPS URL so Telegram can call the webhook.
- A persistent writable disk/volume mounted into the service.
- An environment variable for the service port (PORT).
- Node.js 22 or later, or Docker with the supplied Dockerfile.

A platform that puts the service to sleep while idle is unsuitable unless it supports a separate always-on scheduler. Do not run more than one replica: the current JSON pending-state store has no distributed lock and assumes a single active process.

## Option A — deploy the supplied Dockerfile

Use content-autopilot as the build context and content-autopilot/Dockerfile as the Dockerfile.

Set:
- Container port: 3000 (or the value supplied in PORT).
- Health check: GET /health.
- Persistent volume mount: /data.
- Environment variable: PENDING_FILE=/data/pending.json.
- Replicas/instances: 1.

The image uses Node 22, installs production dependencies with npm ci, runs as the unprivileged node user, and stores pending publication state outside the image.

## Option B — native Node.js deployment

Set the service root/working directory to content-autopilot.

Build/install command:

    npm ci --omit=dev

Start command:

    npm start

Runtime:
- Node.js 22 or newer.
- PORT supplied by the platform.
- PENDING_FILE set to a path on the platform's persistent disk, for example /data/pending.json.
- The persistent directory must be mounted and writable by the app process.

Do not use the repository's local data directory as production persistence on an ephemeral filesystem.

## Required secrets and settings

Set these in the platform's secret/environment-variable settings. Never commit real values.

| Variable | Required | Notes |
|---|---:|---|
| TELEGRAM_BOT_TOKEN | Yes | Token from BotFather |
| TELEGRAM_CHAT_ID | Yes | Owner's private one-to-one Telegram chat ID |
| TELEGRAM_CHANNEL_ID | Yes | Destination Telegram channel ID |
| TELEGRAM_WEBHOOK_SECRET | Yes | Generate a separate random secret |
| VK_GROUP_ID | Yes | Numeric community ID, without a sign |
| VK_COMMUNITY_TOKEN | Yes | Community token with wall posting permission |
| INTERNAL_API_SECRET | Yes | Separate random bearer secret for /check/now |
| TIMEZONE | No | Defaults to Europe/Moscow |
| CRON_SCHEDULE | No | Defaults to 0 9 * * * |
| AUTO_PUBLISH_ENABLED | No | Keep false; explicit owner approval is the safe default |
| APPROVAL_WINDOW_MINUTES | No | Only used if timed auto-publish is deliberately enabled |
| PENDING_FILE | Yes in production | Must be on the mounted persistent volume |
| PORT | Platform-defined | The app listens on this value |

Create two separate secrets for TELEGRAM_WEBHOOK_SECRET and INTERNAL_API_SECRET. Do not put them in source code, build arguments, logs or public issue comments.

## Configure Telegram webhook after deployment

The application needs a public HTTPS address. After the service is healthy, set the webhook:

    curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
      -d "url=https://YOUR-PUBLIC-APP-URL/telegram/webhook" \
      -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"

Check that the Telegram response contains "ok": true. Then inspect webhook information using Telegram's getWebhookInfo method. Do not share a URL containing the bot token.

## Pre-launch checklist

- [ ] Node 22 runtime or the supplied Docker image is selected.
- [ ] The service has exactly one active replica.
- [ ] The persistent volume is mounted at /data and PENDING_FILE=/data/pending.json.
- [ ] /health returns HTTP 200 over HTTPS.
- [ ] All required secrets are configured in the hosting dashboard.
- [ ] Telegram bot can message the owner's private chat.
- [ ] Telegram bot is an administrator in the destination channel with permission to publish.
- [ ] The webhook is configured and getWebhookInfo reports no pending delivery errors.
- [ ] VK community token can publish to the correct community wall.
- [ ] AUTO_PUBLISH_ENABLED is false.
- [ ] A draft arrives in the private Telegram chat.
- [ ] Cancel button is tested before any live publication.
- [ ] Only after explicit owner review, one controlled test post is approved and checked on both destinations.

No real-account connection, webhook registration, or live publication is performed by the repository change itself.
