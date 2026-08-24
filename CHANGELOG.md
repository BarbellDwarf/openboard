# Changelog

## v0.1.0 (in final testing)

Initial release.

- Accounts with email and password, plus generic OIDC sign-in for Authentik, Authelia, and similar discovery-based providers.
- First-run setup page that creates the administrator account, plus moderation: admins close games, delete any chat message, list members, and issue single-use password reset codes.
- Live games over WebSockets with clocks for bullet, blitz, rapid, and classical controls. Clock state survives server restarts without charging downtime.
- Correspondence games with days-per-move deadlines, deadline display, reminders, and automatic loss on flag.
- Eight rulesets with shuffled Chess960 starts and Crazyhouse pocket drops in the board UI. Server-authoritative validation throughout.
- Glicko-2 ratings per variant per speed class, applied exactly once per game, with public leaderboards.
- Direct challenges with expiry and single-use accept links, plus a preference-matched quick-pairing pool.
- Per-game chat with rate limits.
- In-app notification center with an unread badge, plus optional web push with per-user subscription scoping.
- Browser bots at five strength levels across every ruleset, playing server-side so games continue after a restart.
- Board themes, piece sets including original Arcane and Draconic artwork, sounds, motion preferences, and a persisted night and day color scheme.
- Responsive layouts from phone to desktop, with keyboard-accessible boards and reduced-motion support.
- PGN download for finished games, with SetUp and FEN headers for non-standard starting positions.
- An in-app Learn section documenting every ruleset against the engine.
- Password recovery through admin-issued single-use codes, or by email when SMTP is configured. Soft address verification when SMTP is set.
- Installable progressive web app with real branding, an offline app shell, and health and deployment checks for compose.
- Deployment as two Docker containers (app plus PostgreSQL) with boot-time idempotent migrations and a required-secret guard.
