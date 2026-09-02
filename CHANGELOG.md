# Changelog

## v0.1.0 (in final testing)

Initial release.

- Accounts with email and password, plus generic OIDC sign-in for Authentik and Authelia.
- Live games over WebSockets: bullet, blitz, rapid, classical clocks.
- Correspondence games with days-per-move deadlines and reminders.
- Eight rulesets: standard, Chess960, Crazyhouse, King of the Hill, Three-check, Atomic, Horde, Racing Kings. Server-authoritative validation throughout.
- Glicko-2 ratings per variant per speed class, with public leaderboards.
- Challenges and a quick-pairing pool.
- Per-game chat.
- Board themes and three piece sets including original wizard-themed (Arcane) and dragon-themed (Draconic) artwork.
- In-app notifications and web push.
- Installable progressive web app with offline shell.
- Browser bots at five strength levels across every ruleset.
- Deployment as two Docker containers (app plus PostgreSQL).
