# Credits

OpenBoard stands on open-source art and code. Everything shipped in this repository is listed here with its license.

## Code

- OpenBoard itself: GPL-3.0-or-later.
- [chessground](https://github.com/lichess-org/chessground): GPL-3.0-or-later. Board rendering.
- [chessops](https://github.com/niklasf/chessops): GPL-3.0-or-later. Move generation and rules for all variants.
- [better-auth](https://better-auth.com): MIT. Authentication.
- Remaining runtime libraries (SvelteKit, Svelte, Socket.IO, Drizzle ORM, pg, web-push, croner, vite-plugin-pwa) carry their own OSI licenses; see package.json.

## Piece sets

| Set                      | Files                  | License                                                                                  | Source                      |
| ------------------------ | ---------------------- | ---------------------------------------------------------------------------------------- | --------------------------- |
| Classic                  | static/pieces/cburnett | BSD-3-Clause option of the multi-licensed cburnett set. Attribution: Colin M.L. Burnett. | Wikimedia Commons / lichess |
| Arcane (wizard-themed)   | static/pieces/arcane   | Project-original artwork, GPL-3.0-or-later. Authored for OpenBoard.                      | this repository             |
| Draconic (dragon-themed) | static/pieces/draconic | Project-original artwork, GPL-3.0-or-later. Authored for OpenBoard.                      | this repository             |

## Board themes

All board color schemes are project-original CSS gradients defined as theme classes in src/app.css, GPL-3.0-or-later.

## Sounds

static/sounds/openboard contains project-original synthesized audio (simple oscillator envelopes), GPL-3.0-or-later. No third-party audio ships with OpenBoard.

## Fonts

Marcellus, Work Sans, and IBM Plex Mono via Fontsource packages, each under the SIL Open Font License.

## Not included

Lichess board artwork, sound packs, and several popular piece sets (alpha, merida, most CC BY-NC sets) are deliberately excluded because their licenses do not permit redistribution here.
