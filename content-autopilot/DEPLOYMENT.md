# TAINA Content Review → SMMplanner — deployment

This service prepares and approves TAINA posts, then hands approved copy to the owner in Telegram. SMMplanner is responsible for scheduling and publishing to Telegram and VK.

## Amvera deployment (repository-root configuration)

The repository is a monorepo. Amvera reads `amvera.yml` from the **repository root**, so deploy this branch/repository from its root; do not point Amvera at `content-autopilot/` as if its nested files were the repository configuration.

The root files are intentionally scoped to this service:
- `amvera.yml` selects the root `Dockerfile`, mounts persistent storage at `/data`, and exposes port `3000`.
- The root `Dockerfile` installs only `content-autopilot` production dependencies and copies only that service.
- The root `.dockerignore` excludes the other projects, local secrets, test files and pending state from the build context.

Amvera's official configuration documentation requires its `amvera.yml` at repository root and supports `build.dockerfile`, `run.persistenceMount` and `run.containerPort`. See:
- https://docs.amvera.ru/applications/configuration/config-file.html
- https://docs.amvera.ru/applications/configuration/docker.html

After connecting the repository/branch in Amvera, verify the build log, then configure the required environment variables below. The application must run as exactly one instance: its JSON pending-state file has no distributed lock.

## Required secrets and settings

Set these only in the Amvera secret/environment-variable settings. Never commit real values.

| Variable | Required | Notes |
|---|---:|---|
| TELEGRAM_BOT_TOKEN | Yes | Dedicated bot for Content Autopilot; do not reuse the Sales Engine bot token because each bot has one active webhook URL |
| TELEGRAM_CHAT_ID | Yes | Owner's private one-to-one Telegram chat ID |
| TELEGRAM_APPROVER_ID | Yes | Numeric Telegram user ID allowed to approve drafts |
| TELEGRAM_WEBHOOK_SECRET | Yes | Random secret; Telegram sends it in the webhook header |
| INTERNAL_API_SECRET | Yes | Separate random bearer secret for /check/now |
| TIMEZONE | No | Defaults to Europe/Moscow |
| CRON_SCHEDULE | No | Defaults to 0 9 * * * |
| PENDING_FILE | Set by image | Defaults to /data/pending.json |
| PORT | Set by image | Defaults to 3000 |

No VK or Telegram channel token is needed here. SMMplanner owns the social-channel connections and publication schedule.

## Preflight before webhook registration

1. Build and start the application in Amvera.
2. Confirm `GET /health` returns HTTP 200 over HTTPS.
3. Confirm `GET /ready` returns HTTP 200 with `ready: true` and `storageWritable: true`.
4. Check that the service has exactly one running instance and the `/data` persistent mount is active.
5. Write the public HTTPS application URL down privately. Do not send it together with secrets.

The Docker image sets `PENDING_FILE=/data/pending.json`. Never point production pending state at the container's ephemeral filesystem.

## Configure Telegram webhook

Only after /health and /ready pass, set the Telegram webhook from a trusted terminal. Keep the bot token out of shell history where possible; never share a URL containing it.

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://YOUR-PUBLIC-APP-URL/telegram/webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

Check that the response contains `"ok": true`, then inspect Telegram's `getWebhookInfo` method. Do not put the bot token in screenshots, logs, tickets or chat.

## Safe pilot sequence

1. Connect the TAINA Telegram channel and VK community to SMMplanner in its own account.
2. Let the service send one calendar draft to the owner's private Telegram chat.
3. Confirm the displayed text and date.
4. Approve the draft and confirm that a separate copy-ready message arrives in the owner's private chat.
5. Copy the approved text into SMMplanner, select the Telegram and VK destinations, set the publication time, and verify the scheduled item in its calendar.
6. Run a separate cancellation test and confirm that nothing is handed off to SMMplanner.

**SMMplanner is the only publishing scheduler.** This service does not publish directly to VK or Telegram channels, does not store channel credentials and does not automate SMMplanner login/session cookies. The handoff is intentionally manual until SMMplanner provides an official supported API or import contract.

## Ambiguous delivery and manual review

Before each Telegram side effect, the service persists an intent state such as `creating_draft` or `handoff_dispatching`. If the process restarts or Telegram times out during a send, the state becomes `needs_review`; the service does not automatically resend. Inspect the private Telegram chat before any manual recovery. Do not clear `/data/pending.json` or retry an uncertain send until its outcome is known.

## Local checks

From the repository root:

```bash
docker build -t taina-content-autopilot -f Dockerfile .
```

For unit tests:

```bash
cd content-autopilot
npm ci
npm test
```

No social-channel publication, production webhook registration, or real external integration test is performed by a code merge alone.
