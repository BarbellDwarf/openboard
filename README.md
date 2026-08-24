# OpenBoard

OpenBoard is a self-hostable online chess platform. It runs as two Docker containers: one application container plus PostgreSQL. Players get live games, correspondence games, rated play with leaderboards, per-game chat, computer opponents, and eight chess rulesets.

v0.1.0 is in final testing on the release branch. This document describes what ships.

## Features

### Play

- Live games over WebSockets with clocks for bullet, blitz, rapid, and classical time controls.
- Correspondence games with days-per-move deadlines, deadline reminders, and automatic loss when a clock flags.
- Direct challenges with expiry and single-use accept links, plus a quick-pairing pool that matches on preferences.
- Computer opponents at five strength levels. Bot moves run server-side, so games continue after a restart and never depend on an open tab.
- PGN download for finished games, with SetUp and FEN headers for non-standard starting positions.

### Rulesets

Standard, Chess960 with shuffled starting arrays, Crazyhouse with pocket drops, King of the Hill, Three-check, Atomic, Horde, and Racing Kings. The server validates every move and detects every finish condition. The in-app Learn section documents each ruleset against the engine itself.

### Accounts and administration

- Registration and sign-in by email and password, or single sign-on through generic OIDC providers such as Authentik and Authelia.
- A first-run setup page creates the administrator account and then closes permanently.
- Moderators close any game, delete any chat message, list members, and issue single-use password reset codes that work without outgoing email.
- Optional SMTP enables emailed password resets, soft address verification, and deadline reminder email.

### Progression and social

- Glicko-2 ratings tracked per variant and speed class, with public leaderboards.
- Per-game chat with rate limits and moderator deletion.
- In-app notifications with an unread badge, plus optional web push for challenge responses, draw offers, and results.

### Interface

- Responsive layouts from phone to desktop, in night and day color schemes with a persisted toggle.
- Five board themes, three piece sets, sounds with volume control, motion preferences, and board coordinates. Saved choices apply to every board you play on.
- Installable as a progressive web app with an offline app shell and real branding.

## Quick start

```bash
docker compose up -d
```

Then open the site and follow the setup page to create the administrator account. Configuration lives in `.env` next to `docker-compose.yml` and is documented in [docs/deploy.md](docs/deploy.md), including required secrets, optional SMTP, and multi-origin access.

## Administration

The account created through `/setup` holds the `admin` role. Administrators close any running game, delete any chat message, view the member roster at `/admin/users`, and issue single-use password reset codes shown once and valid for 24 hours. Every moderation power is enforced on the server; roles live in the `users.role` column and default to `user`.

## Development

Node 22 is required.

```bash
npm install        # install dependencies
npm run dev        # development server
npm run lint       # prettier and eslint
npm run check      # svelte-check
npm run test       # vitest
npm run build      # production build plus the realtime bundle
```

A UI audit walks every route in both color schemes at desktop and mobile widths, checks layout bounds and touch targets, and captures screenshots into `.review-screens/`:

```bash
npm i -D playwright && npx playwright install chromium
node scripts/ui-audit.mjs
```

## Documentation

- [docs/deploy.md](docs/deploy.md): deployment, configuration, email, backups, upgrades, troubleshooting.
- [docs/oidc.md](docs/oidc.md): single sign-on setup and provider naming.
- [CREDITS.md](CREDITS.md): asset licenses and attributions.

## License

GPL-3.0-or-later. Free to run, study, modify, and self-host. The license follows from the chess libraries at the core of the project, chessground and chessops. Piece sets and sounds ship under their own permissive licenses, documented in CREDITS.md.
