import { describe, expect, it } from 'vitest';
import { makeFen } from 'chessops/fen';
import { parseSan } from 'chessops/san';

import {
	applyMove,
	drawByFiftyMoves,
	drawByRepetition,
	detectFinish,
	loadPosition,
	startPosition
} from './engine';
import {
	initialClock,
	applyMoveToClock,
	flaggedColor,
	remainingFor,
	correspondenceDeadline
} from './clocks';
import { buildPgn, sanMovesFromMovetext } from './pgn';
import { VARIANTS } from './types';

function perftMove(
	variant: 'standard' | 'chess960',
	xfen: string | undefined,
	depth: number
): number {
	const pos = loadPosition(variant, xfen);
	return perftInner(pos, depth);
}

function perftInner(pos: ReturnType<typeof loadPosition>, depth: number): number {
	if (depth === 0) return 1;
	let nodes = 0;
	for (const [from, destSet] of pos.allDests().entries()) {
		for (const to of destSet) {
			const child = pos.clone();
			child.play({ from, to });
			nodes += perftInner(child, depth - 1);
		}
	}
	return nodes;
}

describe('rules engine', () => {
	it('counts perft depth 3 from the standard start as 8902', () => {
		expect(perftMove('standard', undefined, 3)).toBe(8902);
	});

	it('applies en passant correctly', () => {
		const fen = 'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3';
		const result = applyMove('standard', fen, 'e5f6');
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.san).toBe('exf6');
	});

	it('promotes with the chosen piece', () => {
		const fen = '8/P6k/8/8/8/8/7K/8 w - - 0 1';
		const result = applyMove('standard', fen, 'a7a8q');
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.san).toBe('a8=Q');
	});

	it('keeps castling rights through X-FEN round trips', () => {
		const state = startPosition('standard');
		const reloaded = loadPosition('standard', state.xfen);
		expect(reloaded.castles.castlingRights.size()).toBe(4);
	});

	it('round-trips two Chess960 starting positions', () => {
		for (const fen of [
			'rkbbqnnr/pppppppp/8/8/8/8/PPPPPPPP/RKBBQNNR w KQkq - 0 1',
			'nnrqkbbr/pppppppp/8/8/8/8/PPPPPPPP/NNRQKBBR w KQkq - 0 1'
		]) {
			const pos = loadPosition('chess960', fen);
			expect(makeFen(pos.toSetup())).toBe(fen);
		}
	});

	it('rejects illegal moves without mutating state', () => {
		const state = startPosition('standard');
		const result = applyMove('standard', state.xfen, 'e2e5');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toBe('illegal-move');
	});

	it('detects checkmate and reports the winner', () => {
		const fen = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
		const pos = loadPosition('standard', fen);
		const finish = detectFinish(pos);
		expect(finish).toEqual({ result: 'black', termination: 'checkmate' });
	});

	it('flags repetition after three occurrences', () => {
		const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
		const history = [fen, fen, fen];
		expect(drawByRepetition(history)).toBe(true);
		expect(drawByRepetition([fen])).toBe(false);
	});

	it('detects fifty-move draws', () => {
		expect(drawByFiftyMoves('8/8/8/8/8/8/8/K6k w - - 99 80')).toBe(false);
		expect(drawByFiftyMoves('8/8/8/8/8/8/8/K6k w - - 100 80')).toBe(true);
	});

	it('loads every shipped variant', () => {
		for (const variant of VARIANTS) {
			const state = startPosition(variant);
			expect(state.dests).toBeDefined();
			expect(Object.keys(state.dests).length).toBeGreaterThan(0);
		}
	});
});

describe('clocks', () => {
	it('charges the mover and adds increment', () => {
		const clock = initialClock({ initialMs: 60000, incrementMs: 2000, daysPerMove: null }, 0);
		const next = applyMoveToClock(clock, 'white', 5000, 2000);
		expect(next.whiteMs).toBe(57000);
		expect(next.ticking).toBe('black');
		expect(remainingFor(next, 'black', 7000)).toBe(58000);
	});

	it('flags a side at zero', () => {
		const clock = initialClock({ initialMs: 1000, incrementMs: 0, daysPerMove: null }, 0);
		expect(flaggedColor(clock, 1500)).toBe('white');
		expect(flaggedColor(clock, 500)).toBeNull();
	});

	it('computes correspondence deadlines', () => {
		const day = 24 * 60 * 60 * 1000;
		expect(correspondenceDeadline(3, 0)).toBe(3 * day);
	});
});

describe('pgn', () => {
	it('round-trips a sample game through export and replay', () => {
		const sans = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'];
		const pgn = buildPgn({
			variant: 'standard',
			rated: false,
			whiteName: 'White Player',
			blackName: 'Black Player',
			sanMoves: sans,
			result: null,
			timeControlDescription: '300+2'
		});
		const movetext = pgn.split('\n\n')[1];
		const tokens = sanMovesFromMovetext(movetext);
		expect(tokens).toEqual(sans);

		const pos = loadPosition('standard', undefined);
		for (const san of tokens) {
			const move = parseSan(pos, san);
			expect(move).toBeDefined();
			if (move) pos.play(move);
		}
	});
});
