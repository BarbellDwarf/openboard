import type { DestMap } from '$lib/server/chess/types';

/** Pocket holdings keyed 'wp'/'bq'-style: color letter followed by role letter. */
export type PocketMap = Record<string, number>;

/** Pocket roles in tray display order. */
export const POCKET_ROLES = ['q', 'r', 'b', 'n', 'p'] as const;
export type PocketLetter = (typeof POCKET_ROLES)[number];

const ROLE_NAMES: Record<PocketLetter, string> = {
	q: 'queen',
	r: 'rook',
	b: 'bishop',
	n: 'knight',
	p: 'pawn'
};

export function roleName(letter: PocketLetter): string {
	return ROLE_NAMES[letter];
}

/** Drop UCIs look like 'Q@f5'; board moves are 'e2e4' or 'e7e8q'. */
export function isDropUci(uci: string): boolean {
	return uci.length === 4 && uci[1] === '@';
}

/**
 * Crazyhouse xfen carries pocket holdings in square brackets appended to the
 * board field: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR[] w KQkq - 0 1'.
 * Uppercase letters are white pieces, lowercase black.
 */
export function pocketsFromXfen(xfen: string): PocketMap {
	const boardPart = xfen.split(' ')[0] ?? '';
	const open = boardPart.indexOf('[');
	if (open === -1) return {};
	const close = boardPart.indexOf(']', open);
	if (close === -1) return {};
	const out: PocketMap = {};
	for (const ch of boardPart.slice(open + 1, close)) {
		const letter = ch.toLowerCase();
		if ((POCKET_ROLES as readonly string[]).includes(letter)) {
			const key = `${ch === letter ? 'b' : 'w'}${letter}`;
			out[key] = (out[key] ?? 0) + 1;
		}
	}
	return out;
}

/**
 * Per-color tray counts. The explicit engine field wins when present; parsing
 * the xfen keeps trays working for payloads that omit it.
 */
export function pocketCountsFor(
	pockets: PocketMap | null | undefined,
	xfen: string,
	color: 'white' | 'black'
): Record<string, number> {
	const source = pockets ?? pocketsFromXfen(xfen);
	const prefix = color === 'white' ? 'w' : 'b';
	const out: Record<string, number> = {};
	for (const [key, count] of Object.entries(source)) {
		if (key.startsWith(prefix)) out[key.slice(1)] = count;
	}
	return out;
}

/**
 * Splits chessground-format dests into board moves and drop entries. The
 * server emits drops under synthetic origins ('drop:p', 'drop:n', ...) that
 * map to legal placement squares.
 */
export function splitDropDests(dests: DestMap): {
	boardDests: DestMap;
	dropDests: Record<string, string[]>;
} {
	const boardDests: DestMap = {};
	const dropDests: Record<string, string[]> = {};
	for (const [from, tos] of Object.entries(dests)) {
		if (from.startsWith('drop:')) dropDests[from.slice(5)] = tos;
		else boardDests[from] = tos;
	}
	return { boardDests, dropDests };
}

/** Builds a drop UCI such as 'Q@f5' from a pocket role letter and square. */
export function dropUci(letter: PocketLetter, square: string): string {
	return `${letter.toUpperCase()}@${square}`;
}
