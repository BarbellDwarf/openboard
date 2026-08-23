import type { Termination } from '$lib/server/chess/types';

/**
 * Client-side copy for server termination tokens. The keys mirror the
 * `Termination` union in the rules engine and the compiler enforces full
 * coverage; unknown runtime tokens render as-is instead of crashing.
 */

/** Standalone labels, e.g. the game page verdict panel. */
export const TERMINATION_LABELS: Record<Termination, string> = {
	checkmate: 'Checkmate',
	stalemate: 'Stalemate',
	resignation: 'Resignation',
	timeout: 'Flag fell',
	abandoned: 'Abandoned',
	agreement: 'Draw agreed',
	repetition: 'Threefold repetition',
	'fifty-moves': 'Fifty-move rule',
	insufficient: 'Insufficient material',
	kingofthehill: 'King reached the hill',
	threecheck: 'Third check given',
	'atomic-king-death': 'King exploded',
	'horde-wiped': 'Horde destroyed',
	'racingkings-finish': 'Race finished',
	'admin-closed': 'Closed by a moderator'
};

/** Lowercase phrases that slot into sentences like "White won by ...". */
export const TERMINATION_PHRASES: Record<Termination, string> = {
	checkmate: 'checkmate',
	stalemate: 'stalemate',
	resignation: 'resignation',
	timeout: 'time forfeit',
	abandoned: 'abandonment',
	agreement: 'mutual agreement',
	repetition: 'threefold repetition',
	'fifty-moves': 'fifty-move rule',
	insufficient: 'insufficient material',
	kingofthehill: 'king reached the center',
	threecheck: 'third check given',
	'atomic-king-death': 'king exploded',
	'horde-wiped': 'horde wiped out',
	'racingkings-finish': 'race finished',
	'admin-closed': 'closed by a moderator'
};

/** Label for a termination token; unknown tokens render as-is. */
export function terminationLabel(token: string): string {
	return TERMINATION_LABELS[token as Termination] ?? token;
}

/** Sentence phrase for a termination token; unknown tokens render as-is. */
export function terminationPhrase(token: string): string {
	return TERMINATION_PHRASES[token as Termination] ?? token;
}
