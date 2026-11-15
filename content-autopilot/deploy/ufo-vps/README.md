# TAINA Content Autopilot — UFO.Hosting VPS

This guide deploys the Telegram/VK draft approval service to a Linux VPS. It does not publish anything while being installed. The app sends only a draft to the configured owner chat; VK/Telegram channel publishing still requires an explicit approval button.

## Before starting

- A Linux VPS with SSH and sudo/root. UFO.Hosting lists Linux VPS plans with root access and has an official Docker-on-Ubuntu guide.
- A domain or subdomain pointing to the VPS public IPv4 address.
- Docker Engine and Docker Compose Plugin installed.
- An existing web server/control panel capable of HTTPS reverse proxy (for example, Nginx in Hestia/ISPmanager). Do not install a second web server over an existing panel.
- Bot and community credentials created separately. Never put credentials in Git.

## 1. Install Docker

Use the provider's current guide for the server's exact Ubuntu version:
https://ufo.hosting/blog/ustanovka-docker-i-docker-compose-na-ubuntu-vps

Check:

```bash
docker --version
docker compose version
```

## 2. Get the project

```bash
sudo mkdir -p /opt/taina
sudo chown "$USER":"$USER" /opt/taina
cd /opt/taina
git clone --branch feat/content-autopilot-safe-approval --single-branch https://github.com/ritarakunova-hub/clawdbot.git repo
cd repo/content-autopilot
```

This checks out the safe-approval branch. Do not use the default branch for deployment until the change has been reviewed and merged intentionally.

## 3. Configure secrets

```bash
cp .env.example .env
chmod 600 .env
openssl rand -hex 32
```

Paste the generated value into `ADMIN_WEBHOOK_SECRET` inside `.env`. Generate a different value for `TELEGRAM_WEBHOOK_SECRET` and keep both private.

Fill in:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID` (owner's private chat)
- `TELEGRAM_CHANNEL_ID` (test channel first)
- `TELEGRAM_WEBHOOK_SECRET` (generate with `openssl rand -hex 32`)
- `TELEGRAM_WEBHOOK_URL` (`https://YOUR-SUBDOMAIN/telegram/webhook`)
- `ADMIN_WEBHOOK_SECRET`
- `TELEGRAM_APPROVER_ID` (required positive numeric Telegram user ID; do not leave blank)
- `VK_GROUP_ID` and `VK_COMMUNITY_TOKEN` (test community first)
- `TIMEZONE=Europe/Moscow`
- `CRON_SCHEDULE=0 9 * * *`

Do not share `.env`, screenshots of secrets, or command output containing tokens.

## 4. Persistent data and first start

The container runs as UID 1000 and stores its pending approval record in the bind-mounted `data/` directory.

```bash
mkdir -p data
sudo chown -R 1000:1000 data
docker compose up -d --build
docker compose ps
docker compose logs --tail 50 app
curl http://127.0.0.1:3000/health
docker compose exec app node scripts/preflight.js
```

The app port is bound to loopback only. It is not exposed directly to the public internet. If port 3000 is already used on the VPS, change both the host side of the `ports` mapping and the reverse proxy target consistently.

## 5. HTTPS reverse proxy

In the existing panel's domain settings, add a reverse proxy from your chosen subdomain to:

`http://127.0.0.1:3000`

Enable the panel's HTTPS certificate before setting the Telegram webhook. Do not expose `/check/now` to the public internet without the admin secret; the secret check is a second layer, not a substitute for restricting the route at the proxy/firewall when possible.

The Telegram webhook URL must be:

`https://YOUR-SUBDOMAIN/telegram/webhook`

Set `TELEGRAM_WEBHOOK_URL=https://YOUR-SUBDOMAIN/telegram/webhook` in `.env`. Then load the environment and run the included setup script. It sends the bot token only inside the API request URL and the webhook secret in the POST body; neither secret is written to shell arguments or script output:

```bash
docker compose exec app node scripts/set-telegram-webhook.js
```

The script rejects non-HTTPS webhook URLs, validates the secret format, checks Telegram's API response, and prints only the public webhook URL. Never paste credentials into chat, Git, screenshots, or shell commands.

## 6. Smoke tests before production

1. Export the local environment file and invoke the protected manual check (this sends a draft only if today's calendar has a ready post):
   ```bash
   set -a
   . ./.env
   set +a
   curl -X POST http://127.0.0.1:3000/check/now \
     -H "x-taina-admin-secret: $ADMIN_WEBHOOK_SECRET"
   ```
2. Confirm a draft arrives in the private Telegram chat and contains both VK and Telegram variants.
3. Confirm no channel post is created before the approval button is pressed.
4. Approve only against test Telegram and VK destinations. Confirm each gets the correct text.
5. Test the reject button and verify neither channel receives a post.
6. Stop and start the container while a draft is awaiting approval. Confirm it stays pending and is not auto-published.
7. Only after these checks, switch to intended production channel/community IDs.

The app does not auto-publish on silence or restart.

## 7. Backups and routine maintenance

Back up the `data/` directory and `.env` securely (separately, encrypted, access restricted). `data/pending.json` contains operational state but no access tokens. Do not upload `.env` to cloud drives without encryption.

Update the code:

```bash
git pull --ff-only
docker compose up -d --build
docker compose ps
docker compose logs --tail 50 app
```

Backup `data/` before updates. Never run `docker compose down -v` for this deployment; the app uses a bind mount so the approval state remains on disk.

## Important limits

- This is a single-instance service with a local JSON approval record. Do not run multiple replicas against the same directory.
- Use only one bot instance for the configured webhook.
- Telegram and VK partial failures require manual inspection; the app will not blindly retry.
- No real VK/Telegram publish test has been run by this repository change.
- Do not use real customer, medical, personal, financial, or confidential data in draft examples.
