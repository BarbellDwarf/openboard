# Deploying OpenBoard

## Requirements

- Docker and Docker Compose
- A domain (or a local host entry) pointing at the machine
- HTTPS in front of the app for web push and PWA install prompts (Caddy, nginx, or Traefik all work)

## Quick start

```bash
git clone https://github.com/BarbellDwarf/openboard.git
cd openboard
cp .env.example .env
```

Edit `.env`:

| Variable                                                                   | Required | Purpose                                                                                                                                                                         |
| -------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DATABASE_URL                                                               | no       | Compose-managed: the app container gets `postgres://openboard:openboard@db:5432/openboard` from docker-compose.yml. Set it yourself only when pointing at an external Postgres. |
| ORIGIN                                                                     | yes      | Public URL of the site, e.g. `https://chess.example.com`. Used for auth callbacks and CSRF checks. Compose defaults to `http://localhost:3000`; override in `.env`.             |
| BETTER_AUTH_SECRET                                                         | yes      | Long random string. Generate with `openssl rand -base64 32`. Required: compose refuses to start without it.                                                                     |
| PORT / HOST                                                                | no       | Listen address for the app container. Defaults to 3000 on 0.0.0.0.                                                                                                              |
| VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT                       | optional | Enables web push. Generate with `npx web-push generate-vapid-keys`. Subject is a `mailto:` address. Without these, in-app notifications still work but push does not.           |
| SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM                  | optional | Enables outgoing email: password-reset mail, address verification, and reminder mail. See "Email (optional)" below.                                                             |
| OIDC_ISSUER_URL / OIDC_CLIENT_ID / OIDC_CLIENT_SECRET / OIDC_PROVIDER_NAME | optional | Generic OIDC sign-in. See docs/oidc.md.                                                                                                                                         |

Then:

```bash
docker compose up -d
```

On startup the app container applies pending database migrations before the server starts. OpenBoard listens on port 3000.

Health check: `GET /healthz`.

## Operations

### Email (optional)

OpenBoard works with or without outgoing email. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` in `.env` to turn it on. Email activates when both `SMTP_HOST` and `SMTP_FROM` are set; the port defaults to 587 and TLS is automatic on port 465. The docker-compose file forwards only `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `ORIGIN` into the app container, so compose users must add an `environment:` line per SMTP variable (for example `SMTP_HOST: ${SMTP_HOST}`) before `docker compose up -d`.

Without any SMTP configuration:

- Password recovery still works. An administrator opens `/admin/users`, presses "Reset password" for the account, and hands the one-time code to the player out of band. The player finishes at `/reset-password`. Codes are single-use and expire after 24 hours.
- Correspondence deadline reminders arrive as in-app notifications.

With SMTP configured, additionally:

- The forgot-password form at `/forgot-password` emails a reset link that lands on the same `/reset-password` page.
- New sign-ups receive a verification email. Verification is soft: sign-in never blocks on it, and unverified accounts keep playing.
- Deadline reminders also go out by email.

The forgot-password form always shows the same neutral confirmation regardless of whether the address exists, so it cannot be used to enumerate accounts.

### Manual migrations

Migrations apply automatically when the app container starts. To run them by hand, for example after inspecting a failed start:

```bash
docker compose exec app node scripts/migrate.mjs
```

The script reads the SQL files shipped in the image from `src/lib/server/db/migrations/` and records applied filenames in a `schema_migrations` table, so it is safe to re-run. Each file runs in one transaction.

Host-side tools such as `npx drizzle-kit migrate` cannot reach the compose database because no Postgres port is published to the host. Use the command above instead.

### Troubleshooting

- Compose exits before creating any container and reports that `BETTER_AUTH_SECRET` is required: the variable is not set. Add `BETTER_AUTH_SECRET=<output of openssl rand -base64 32>` to `.env` next to `docker-compose.yml`.
- App container restarts on a loop: run `docker compose logs app`. A migration failure prints the failing file and statement before exit.

## Reverse proxy notes

Socket.IO upgrades requests from polling to WebSocket. Whatever terminates TLS must forward `Upgrade` and `Connection` headers unchanged.

- Caddy handles this automatically.
- nginx: add `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";` to the location block.
- Set `ORIGIN` to the exact public URL or form submissions will be rejected.

### Multiple origins

OpenBoard trusts exactly one origin, the `ORIGIN` environment variable you publish. If you reach the server from more than one URL, a LAN IP while you harden the reverse proxy, a test hostname plus the domain, or during a domain migration, requests from the second origin will be rejected. `better-auth` reads a comma-separated `BETTER_AUTH_TRUSTED_ORIGINS` list alongside `ORIGIN`; list every origin you use there. The docker-compose file forwards `BETTER_AUTH_TRUSTED_ORIGINS` through automatically, so just add it to `.env`:

```env
BETTER_AUTH_TRUSTED_ORIGINS=http://server.lan:3000,http://localhost:3000
```

Note that session cookies are origin-scoped: signing in through one URL does not authenticate a different URL.

## Backups

Everything persistent lives in the `pgdata` volume. A nightly `pg_dump openboard > backup.sql` is sufficient.

## Upgrading

```bash
git pull
docker compose up -d --build
```

The rebuilt image ships its migration files, and pending migrations apply on container start. Migrations are additive; downgrades are not supported.
