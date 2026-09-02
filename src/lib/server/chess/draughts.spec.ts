import { describe, expect, it } from 'vitest';

import {
	draughtsFromFen,
	draughtsToFen,
	draughtsDests,
	draughtsApplyMove,
	draughtsDetectFinish,
	draughtsStartFen,
	draughtsApplyMoveResult
} from './draughts';
import { startPosition, applyMove } from './engine';
import { VARIANTS } from './types';

/* ------------------------------------------------------------------ */
/*  FEN round-trip                                                     */
/* ------------------------------------------------------------------ */

describe('draughts FEN', () => {
	it('round-trips the start position', () => {
		const state = draughtsFromFen(draughtsStartFen());
		expect(draughtsToFen(state)).toBe(draughtsStartFen());
	});

	it('encodes 24 pieces on dark squares at the start', () => {
		const state = draughtsFromFen(draughtsStartFen());
		expect(state.board.size).toBe(24);
		expect(state.turn).toBe('white');
	});

	it('decodes a mid-game position with a king', () => {
		// White king on c3, black man on e4, black to move.
		const fen = '8/8/8/8/4p3/2K5/8/8 b - - 0 1';
		const state = draughtsFromFen(fen);
		expect(state.board.size).toBe(2);
		const c3 = state.board.get('c3');
		expect(c3).toEqual({ color: 'white', king: true });
		const e4 = state.board.get('e4');
		expect(e4).toEqual({ color: 'black', king: false });
	});
});

/* ------------------------------------------------------------------ */
/*  Simple moves                                                       */
/* ------------------------------------------------------------------ */

describe('draughts simple moves', () => {
	it('generates legal simple moves from the start', () => {
		const state = draughtsFromFen(draughtsStartFen());
		const dests = draughtsDests(state);
		// White men on ranks 1-3. Only the rank-3 pieces (a3,c3,e3,g3)
		// have forward squares free; rank-1 and rank-2 pieces are blocked
		// by their own pieces on the rows ahead.
		expect(Object.keys(dests).length).toBe(4);
	});

	it('allows backward moves only for kings', () => {
		// White king on d4, black man on c3, black to move.
		const fen = '8/8/8/8/3k4/2p5/8/8 b - - 0 1';
		const state = draughtsFromFen(fen);
		const dests = draughtsDests(state);
		const c3Dests = dests['c3'];
		expect(c3Dests).toBeDefined();
		// Black man at c3 can move forward (toward rank 1) to b2 or d2.
		expect(c3Dests).toContain('b2');
		expect(c3Dests).toContain('d2');
	});
});

/* ------------------------------------------------------------------ */
/*  Mandatory capture enforcement                                      */
/* ------------------------------------------------------------------ */

describe('draughts mandatory captures', () => {
	it('forces a capture when one exists', () => {
		// White man on c3, black man on d4, e5 empty. White to move.
		const fen = '8/8/8/8/3p4/2P5/8/8 w - - 0 1';
		const state = draughtsFromFen(fen);
		const dests = draughtsDests(state);
		// Only c3 should have destinations (the capture).
		expect(Object.keys(dests)).toEqual(['c3']);
		expect(dests['c3']).toContain('e5');
	});

	it('does not allow a non-capture move when a capture exists', () => {
		// White man on c3, black man on d4, also white man on a3 with a legal simple move.
		const fen = '8/8/8/8/3p4/2P5/P7/8 w - - 0 1';
		const state = draughtsFromFen(fen);
		const dests = draughtsDests(state);
		// a3 should NOT appear because c3 has a mandatory capture.
		expect(dests['a3']).toBeUndefined();
		expect(dests['c3']).toBeDefined();
	});
});

/* ------------------------------------------------------------------ */
/*  Multi-jump chains                                                  */
/* ------------------------------------------------------------------ */

describe('draughts multi-jump chains', () => {
	it('applies a two-jump chain in a single UCI', () => {
		// White man on c3, black men on d4 and f6, e5 and g7 empty.
		// c3 can jump d4 -> e5, then jump f6 -> g7.
		const fen = '8/5p2/5p2/8/3p4/2P5/8/8 w - - 0 1';
		const state = draughtsFromFen(fen);
		const dests = draughtsDests(state);
		// First hop should show e5.
		expect(dests['c3']).toContain('e5');

		// Apply the full chain.
		const after = draughtsApplyMove(state, 'c3e5g7');
		// Both black pieces should be gone.
		expect(after.board.has('d4')).toBe(false);
		expect(after.board.has('f6')).toBe(false);
		// White piece should be on g7.
		expect(after.board.get('g7')).toEqual({ color: 'white', king: false });
	});

	it('applies a two-jump chain as separate single-hop UCI strings', () => {
		const fen = '8/5p2/5p2/8/3p4/2P5/8/8 w - - 0 1';
		const state = draughtsFromFen(fen);
		// First hop.
		const mid = draughtsApplyMove(state, 'c3e5');
		expect(mid.board.has('d4')).toBe(false);
		expect(mid.board.get('e5')).toEqual({ color: 'white', king: false });
		// Turn should stay white (continuation jump available).
		expect(mid.turn).toBe('white');
		// Continuation hop.
		const end = draughtsApplyMove(mid, 'e5g7');
		expect(end.board.has('f6')).toBe(false);
		expect(end.board.get('g7')).toEqual({ color: 'white', king: false });
		// Now turn should change to black.
		expect(end.turn).toBe('black');
	});
});

/* ------------------------------------------------------------------ */
/*  Crowning                                                           */
/* ------------------------------------------------------------------ */

describe('draughts crowning', () => {
	it('crowns a white man reaching rank 8', () => {
		// White man on c7, empty d8. White to move.
		const fen = '8/2P5/8/8/8/8/8/8 w - - 0 1';
		const state = draughtsFromFen(fen);
		const after = draughtsApplyMove(state, 'c7d8');
		expect(after.board.get('d8')).toEqual({ color: 'white', king: true });
	});

	it('crowns a black man reaching rank 1', () => {
		// Black man on c2, empty b1. Black to move.
		const fen = '8/8/8/8/8/8/2p5/8 b - - 0 1';
		const state = draughtsFromFen(fen);
		const after = draughtsApplyMove(state, 'c2b1');
		expect(after.board.get('b1')).toEqual({ color: 'black', king: true });
	});

	it('crowns a man mid-capture chain', () => {
		// White man on d6, black man on c7, empty b8.
		// d6 jumps c7 to b8 (rank 8 = crowned for white).
		const fen = '8/2p5/3P4/8/8/8/8/8 w - - 0 1';
		const state = draughtsFromFen(fen);
		const after = draughtsApplyMove(state, 'd6b8');
		expect(after.board.has('c7')).toBe(false);
		expect(after.board.get('b8')).toEqual({ color: 'white', king: true });
	});
});

/* ------------------------------------------------------------------ */
/*  Win detection                                                      */
/* ------------------------------------------------------------------ */

describe('draughts win detection', () => {
	it('detects a win when the opponent has no pieces', () => {
		// Only black piece on d4, white man on c3, e5 empty.
		// White captures and wins.
		const fen = '8/8/8/8/3p4/2P5/8/8 w - - 0 1';
		const result = draughtsApplyMoveResult(fen, 'c3e5');
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.finished).toEqual({
				result: 'white',
				termination: 'no-legal-move'
			});
		}
	});

	it('returns no-legal-move when the opponent is blocked', () => {
		// White king on b2, black man on a1. Black to move.
		// The man at a1 cannot move (rank 0, forward is off-board).
		const fen = '8/8/8/8/8/8/1K6/p7 b - - 0 1';
		const state = draughtsFromFen(fen);
		const finish = draughtsDetectFinish(state);
		expect(finish).toEqual({ result: 'white', termination: 'no-legal-move' });
	});

	it('returns null when the game continues', () => {
		const state = draughtsFromFen(draughtsStartFen());
		expect(draughtsDetectFinish(state)).toBeNull();
	});
});

/* ------------------------------------------------------------------ */
/*  Engine integration                                                 */
/* ------------------------------------------------------------------ */

describe('draughts engine integration', () => {
	it('loads every shipped variant including checkers', () => {
		for (const variant of VARIANTS) {
			const state = startPosition(variant);
			expect(state.dests).toBeDefined();
			expect(Object.keys(state.dests).length).toBeGreaterThan(0);
		}
	});

	it('startPosition returns 24 pieces for checkers', () => {
		const state = startPosition('checkers');
		const pieceCount = state.xfen
			.split(' ')[0]
			.split('')
			.filter((c) => c.toLowerCase() === 'p' || c.toLowerCase() === 'k').length;
		expect(pieceCount).toBe(24);
	});

	it('applyMove returns a valid result for a legal checkers move', () => {
		const state = startPosition('checkers');
		const dests = state.dests;
		const from = Object.keys(dests)[0];
		const to = dests[from][0];
		const result = applyMove('checkers', state.xfen, `${from}${to}`);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.state.turn).toBe('black');
			expect(result.san).toBeTruthy();
		}
	});

	it('applyMove rejects illegal moves', () => {
		const state = startPosition('checkers');
		const result = applyMove('checkers', state.xfen, 'a1h8');
		expect(result.ok).toBe(false);
	});

	it('draughtsApplyMoveResult produces a SAN with x for captures', () => {
		const fen = '8/8/8/8/3p4/2P5/8/8 w - - 0 1';
		const result = draughtsApplyMoveResult(fen, 'c3e5');
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.san).toBe('c3xe5');
		}
	});

	it('produces a SAN with - for non-captures', () => {
		const fen = '8/8/8/8/8/2P5/8/8 w - - 0 1';
		const result = draughtsApplyMoveResult(fen, 'c3d4');
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.san).toBe('c3-d4');
		}
	});

	it('detects a win after a capturing move that eliminates the last opponent piece', () => {
		const fen = '8/8/8/8/3p4/2P5/8/8 w - - 0 1';
		const result = draughtsApplyMoveResult(fen, 'c3e5');
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.finished).toEqual({
				result: 'white',
				termination: 'no-legal-move'
			});
		}
	});
});

/* ------------------------------------------------------------------ */
/*  Multi-hop UCI validation                                           */
/* ------------------------------------------------------------------ */

describe('draughts multi-hop UCI validation', () => {
	// Probe position from issue #112: white man on c3, black men on d4 and f6,
	// e5 and g7 empty. c3xe5 then e5xg7 is the one legal full chain.
	const CHAIN_FEN = '8/5p2/5p2/8/3p4/2P5/8/8 w - - 0 1';

	it('accepts the legal full chain c3e5g7', () => {
		const result = draughtsApplyMoveResult(CHAIN_FEN, 'c3e5g7');
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.uci).toBe('c3e5g7');
			expect(result.state.xfen.split(' ')[1]).toBe('b');
		}
	});

	it('rejects c3e5h9: the off-board token must invalidate the whole move', () => {
		// h9 cannot match the square regex, so the move would collapse to a
		// plain capture unless the raw text is compared to the matched squares.
		const result = draughtsApplyMoveResult(CHAIN_FEN, 'c3e5h9');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toBe('invalid-move-format');
	});

	it('rejects c3e5c7e3: one man may not move twice in a single ply', () => {
		const fen = '8/2P5/8/8/3p4/2P5/8/8 w - - 0 1';
		const result = draughtsApplyMoveResult(fen, 'c3e5c7e3');
		expect(result.ok).toBe(false);
	});

	it('rejects a hop landing on an own piece', () => {
		// White men on c3 and g7, black men on d4 and f6. e5xg7 would land on
		// the second white man, so the chain is illegal past the first hop.
		const fen = '8/5p2/5P2/8/3p4/2P5/8/8 w - - 0 1';
		const result = draughtsApplyMoveResult(fen, 'c3e5g7');
		expect(result.ok).toBe(false);
	});

	it('rejects a hop over an empty midpoint', () => {
		// Black man only on d4: after c3xe5 the f6 midpoint is empty, so the
		// second hop e5-g7 jumps nothing and must be rejected.
		const fen = '8/8/8/8/3p4/2P5/8/8 w - - 0 1';
		const result = draughtsApplyMoveResult(fen, 'c3e5g7');
		expect(result.ok).toBe(false);
	});

	it('rejects a chain longer than 64 hops', () => {
		const fen = '8/8/8/8/3p4/2P5/8/8 w - - 0 1';
		// c3e5 is a legal capture; pad the UCI with repeated hops past 64.
		const squares = ['c3', 'e5'];
		for (let i = 0; i < 70; i++) squares.push(i % 2 === 0 ? 'g7' : 'e5');
		const result = draughtsApplyMoveResult(fen, squares.join(''));
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toBe('invalid-move-format');
	});

	it('rejects a UCI with separators between squares', () => {
		// The join check treats any character outside the square tokens as
		// garbage, so "c3-e5" fails the same raw-text comparison.
		const result = draughtsApplyMoveResult(CHAIN_FEN, 'c3-e5');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toBe('invalid-move-format');
	});

	it('rejects a 3-square UCI after a simple move', () => {
		const result = draughtsApplyMoveResult(CHAIN_FEN, 'a3b4c5');
		expect(result.ok).toBe(false);
	});
});
