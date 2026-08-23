# OpenBoard

A self-hostable online chess platform. Live games, long-running correspondence games, rated play with leaderboards, chat, and full support for chess variants. Runs as two Docker containers: one application container plus PostgreSQL.

v0.1.0 is in final testing. The list below reflects what ships; see the [issue tracker](https://github.com/BarbellDwarf/openboard/issues) for what is next.

## Why this exists

Existing chess servers are either hosted services you cannot control, or heavyweight self-hosted builds that demand a small cluster of containers. OpenBoard is a single deployable application with a modern interface, built for people who want their own chess server on a homelab box or a small VPS.

## Planned features

- **Accounts**: register and sign in with email and password. Sessions persist across devices.
- **Live games**: real-time play over WebSockets with clocks for bullet through classical time controls.
- **Correspondence games**: days-per-move time controls for games that run over weeks, with deadline display and automatic loss when a player oversteps.
- **Variants**: standard chess, Chess960, Crazyhouse, King of the Hill, Three-check, Atomic, Horde, and Racing Kings.
- **Ratings and leaderboards**: Glicko-2 ratings tracked per variant and speed class, with public leaderboards.
- **Live board updates**: moves from your opponent appear instantly, including while you have the page open in the background.
- **Chat**: per-game chat alongside the board during live games.
- **Customization**: multiple board themes, piece sets, sound options, animation toggles, and board coordinates.
- **Notifications**: in-app notifications plus optional web push for challenge responses, draw offers, and game results.
- **Progressive web app**: installable on desktop and mobile, served from an offline app shell.
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

GPL-3.0-or-later. Free to run, study, modify, and self-host. The license choice follows from the chess libraries at the core of the project (chessground and chessops), which are GPL licensed. Piece sets and sounds ship under their own permissive licenses, documented in the asset credits.
