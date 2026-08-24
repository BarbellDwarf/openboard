/** Shared contracts for the rules engine. Consumed by realtime, UI, and bots. */

export const VARIANTS = [
	'standard',
	'chess960',
	'crazyhouse',
	'kingofthehill',
	'threecheck',
	'atomic',
	'horde',
	'racingkings',
	'checkers',
	'chinese-checkers'
] as const;

export type VariantId = (typeof VARIANTS)[number];

export type SpeedClass = 'bullet' | 'blitz' | 'rapid' | 'classical';

export type Color = 'white' | 'black';

export type GameStatus = 'created' | 'started' | 'finished' | 'aborted';

export type ResultValue = 'white' | 'black' | 'draw';

export type Termination =
	| 'checkmate'
	| 'stalemate'
	| 'resignation'
	| 'timeout'
	| 'abandoned'
	| 'agreement'
	| 'repetition'
	| 'fifty-moves'
	| 'insufficient'
	| 'kingofthehill'
	| 'threecheck'
	| 'atomic-king-death'
	| 'horde-wiped'
	| 'racingkings-finish'
	| 'chinese-checkers-finish'
	| 'no-legal-move'
	| 'admin-closed';

export interface TimeControl {
	initialMs: number | null;
	incrementMs: number | null;
	daysPerMove: number | null;
}

/** chessground-format destinations: origin square to destination squares. */
export type DestMap = Record<string, string[]>;

export interface EngineState {
	variant: VariantId;
	xfen: string;
	turn: Color;
	dests: DestMap;
	inCheck: boolean;
	checkCount?: { white: number; black: number };
	pockets?: Record<string, number>;
}

export interface FinishedInfo {
	result: ResultValue;
	termination: Termination;
}

export type ApplyMoveResult =
	| {
			ok: true;
			state: EngineState;
			san: string;
			uci: string;
			finished: FinishedInfo | null;
	  }
	| { ok: false; error: 'illegal-move' | 'invalid-move-format' | 'invalid-position' };

export function speedClassFor(tc: TimeControl): SpeedClass {
	if (tc.daysPerMove != null) return 'classical';
	const estimatedMinutes = ((tc.initialMs ?? 0) + 40 * (tc.incrementMs ?? 0)) / 60000;
	if (estimatedMinutes < 3) return 'bullet';
	if (estimatedMinutes < 9) return 'blitz';
	if (estimatedMinutes < 25) return 'rapid';
	return 'classical';
}
