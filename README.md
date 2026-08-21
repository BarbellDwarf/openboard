# OpenBoard

A self-hostable online chess platform. Live games, long-running correspondence games, rated play with leaderboards, chat, and full support for chess variants. Runs as two Docker containers: one application container plus PostgreSQL.

Status: early development. The feature set below is the target for v0.1.0, tracked on the [issue tracker](https://github.com/BarbellDwarf/openboard/issues).

## Why this exists

Existing chess servers are either hosted services you cannot control, or heavyweight self-hosted builds that demand a small cluster of containers. OpenBoard is a single deployable application with a modern interface, built for people who want their own chess server on a homelab box or a small VPS.

## Planned features

- **Accounts**: register and sign in with email and password. Sessions persist across devices.
- **Live games**: real-time play over WebSockets with clocks for bullet through classical time controls.
- **Correspondence games**: days-per-move time controls for games that run over weeks. Move reminders through browser notifications.
- **Variants**: standard chess, Chess960, Crazyhouse, King of the Hill, Three-check, Atomic, Horde, and Racing Kings.
- **Ratings and leaderboards**: Glicko-2 ratings tracked per variant and speed class, with public leaderboards.
- **Live board updates**: moves from your opponent appear instantly, including while you have the page open in the background.
- **Chat**: per-game chat alongside the board during live games.
- **Customization**: multiple board themes, piece sets, sound options, animation toggles, and board coordinates.
- **Notifications**: in-app notifications plus optional web push for challenges, moves in correspondence games, and game results.
- **Progressive web app**: installable on desktop and mobile, works offline for browsing history.
- **Responsive design**: the same interface adapts from phone to desktop.

## Docker deployment

A `docker-compose.yml` ships with the repository once v0.1.0 lands:

```
docker compose up -d
```

The application listens on port 3000 by default. Configuration happens through environment variables documented in the deployment guide.

## Tech stack

- SvelteKit (Svelte 5) frontend with server-side rendering
- Node.js backend with Socket.IO for real-time play
- PostgreSQL with Drizzle ORM
- Server-authoritative move validation for all variants
- Web Push for notifications

## License

Apache-2.0. Free to run, modify, and self-host. No feature gates.
