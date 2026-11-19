# TAINA Content Review → SMMplanner deployment

This service prepares and approves content, then hands the approved copy to the owner in Telegram. SMMplanner is responsible for scheduling and publishing to Telegram and VK.

The app is provider-neutral and includes a Dockerfile. It can also run as a native Node.js service.

## Host requirements

- A continuously running web process (the built-in cron scheduler runs inside it).
- A public HTTPS URL so Telegram can call the webhook.
- A persistent writable disk/volume mounted into the service.
- An environment variable for the service port (PORT).
- Node.js 22 or later, or Docker with the supplied Dockerfile.

Do not run more than one replica: the current JSON pending-state store has no distributed lock.

## Option A — deploy the supplied Dockerfile

Use content-autopilot as the build context and content-autopilot/Dockerfile as the Dockerfile.

Set:
- Container port: 3000 (or the value supplied in PORT).
- Liveness health check: GET /health.
- Readiness check after configuration: GET /ready.
- Persistent volume mount: /data.
- Environment variable: PENDING_FILE=/data/pending.json.
- Replicas/instances: 1.

The image uses Node 22, installs production dependencies with npm ci, runs as the unprivileged node user, and stores pending state outside the image.

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
| TELEGRAM_BOT_TOKEN | Yes | Bot token from BotFather |
| TELEGRAM_CHAT_ID | Yes | Owner's private one-to-one Telegram chat ID |
| TELEGRAM_WEBHOOK_SECRET | Yes | Generate a random secret |
| INTERNAL_API_SECRET | Yes | Separate random bearer secret for /check/now |
| TIMEZONE | No | Defaults to Europe/Moscow |
| CRON_SCHEDULE | No | Defaults to 0 9 * * * |
| PENDING_FILE | Yes in production | Must be on the mounted persistent volume |
| PORT | Platform-defined | The app listens on this value |

No VK or Telegram channel token is needed here. SMMplanner owns the social-channel connections and publication schedule.

## Configure Telegram webhook after deployment

The application needs a public HTTPS address. After the service is healthy, set the webhook:

    curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
      -d "url=https://YOUR-PUBLIC-APP-URL/telegram/webhook" \
      -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"

Check that the Telegram response contains "ok": true. Then inspect webhook information using Telegram's getWebhookInfo method. Do not share a URL containing the bot token.

## SMMplanner operating flow

1. Connect the TAINA Telegram channel and VK community to SMMplanner in its own account.
2. The content-review service sends a draft to the owner's private Telegram chat.
3. After owner approval, copy the separate ready message into SMMplanner.
4. Select the Telegram and VK destinations and set the publication date/time.
5. Confirm the scheduled item in SMMplanner's calendar.

The current handoff is intentionally manual because no official public developer API for creating scheduled SMMplanner posts was found during implementation. Do not reverse-engineer private endpoints or automate login/session cookies. If SMMplanner later supplies a supported API/import contract, integrate only against that documented interface.

## Pre-launch checklist

- [ ] Node 22 runtime or supplied Docker image is selected.
- [ ] Exactly one active app instance is running.
- [ ] Persistent volume is mounted at /data and PENDING_FILE=/data/pending.json.
- [ ] /health returns HTTP 200 over HTTPS.
- [ ] All required Telegram secrets are configured in the hosting dashboard.
- [ ] /ready returns HTTP 200 and confirms writable persistent storage.
- [ ] Telegram bot can message the owner's private chat.
- [ ] Telegram webhook is configured and getWebhookInfo reports no pending delivery errors.
- [ ] TAINA Telegram and VK pages are connected inside SMMplanner.
- [ ] One draft is reviewed, approved, copied into SMMplanner, and verified in its schedule.
- [ ] A cancelled draft is confirmed not to appear in SMMplanner.

No social-channel publication, SMMplanner login, or production webhook registration is performed by the repository change itself.