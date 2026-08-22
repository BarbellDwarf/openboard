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

| Variable                                                                   | Required        | Purpose                                                                                                                                                               |
| -------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DATABASE_URL                                                               | yes             | Postgres connection string. The compose file defaults to `postgres://openboard:openboard@db:5432/openboard`.                                                          |
| ORIGIN                                                                     | yes             | Public URL of the site, e.g. `https://chess.example.com`. Used for auth callbacks and CSRF checks.                                                                    |
| BETTER_AUTH_SECRET                                                         | production only | Long random string. Generate with `openssl rand -base64 32`.                                                                                                          |
| PORT / HOST                                                                | no              | Listen address for the app container. Defaults to 3000 on 0.0.0.0.                                                                                                    |
| VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT                       | optional        | Enables web push. Generate with `npx web-push generate-vapid-keys`. Subject is a `mailto:` address. Without these, in-app notifications still work but push does not. |
| OIDC_ISSUER_URL / OIDC_CLIENT_ID / OIDC_CLIENT_SECRET / OIDC_PROVIDER_NAME | optional        | Generic OIDC sign-in. See docs/oidc.md.                                                                                                                               |

Then:

```bash
docker compose up -d --build
```

OpenBoard listens on port 3000. Apply migrations once:

```bash
DATABASE_URL=... npx drizzle-kit migrate
```

Health check: `GET /healthz`.

## Reverse proxy notes

Socket.IO upgrades requests from polling to WebSocket. Whatever terminates TLS must forward `Upgrade` and `Connection` headers unchanged.

- Caddy handles this automatically.
- nginx: add `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";` to the location block.
- Set `ORIGIN` to the exact public URL or form submissions will be rejected.

## Backups

Everything persistent lives in the `pgdata` volume. A nightly `pg_dump openboard > backup.sql` is sufficient.

## Upgrading

```bash
git pull
docker compose up -d --build
DATABASE_URL=... npx drizzle-kit migrate
```

Migrations are additive; downgrades are not supported.
