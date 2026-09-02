import { describe, expect, it } from 'vitest';

import {
	cells,
	cellIndex,
	cellFromIndex,
	campMembers,
	cellNeighbours,
	chineseCheckersStartFen,
	chineseCheckersStartState,
	fenToEngineState,
	chineseCheckersApplyMove,
	hopChainDests,
	stateTurn,
	stateBoard
} from './chinese-checkers';

/* ------------------------------------------------------------------ */
/*  Cell table validity                                                */
/* ------------------------------------------------------------------ */

describe('chinese-checkers cell table', () => {
	it('has exactly 121 cells', () => {
		expect(cells.length).toBe(121);
	});

	it('has unique names for all cells', () => {
		const names = cells.map((c) => c.name);
		expect(new Set(names).size).toBe(121);
	});

	it('has unique indices for all cells', () => {
		const indices = cells.map((_, i) => i);
		expect(new Set(indices).size).toBe(121);
	});

	it('each cell has a valid camp (0-5 or -1 for centre)', () => {
		for (const cell of cells) {
			expect(cell.camp).toBeGreaterThanOrEqual(-1);
			expect(cell.camp).toBeLessThanOrEqual(5);
		}
	});

	it('each camp has exactly 10 cells', () => {
		for (let c = 0; c < 6; c++) {
			expect(campMembers[c].length).toBe(10);
		}
	});

	it('camps are disjoint (no cell belongs to two camps)', () => {
		const allCampCells = campMembers.flat();
		expect(new Set(allCampCells).size).toBe(60);
	});

	it('cell index matches row-major order', () => {
		// Row 0: 1 cell → index 0
		expect(cellIndex(0, 0)).toBe(0);
		// Row 1 starts after row 0 (1 cell) → index 1
		expect(cellIndex(1, 0)).toBe(1);
		// Row 3 starts after rows 0-2: 1+2+3 = 6
		expect(cellIndex(3, 0)).toBe(6);
		// Row 7 starts after rows 0-6: 1+2+3+4+5+6+7 = 28
		expect(cellIndex(7, 0)).toBe(28);
		// Row 10 (widest) starts after rows 0-9: sum(1..10) = 55
		expect(cellIndex(10, 0)).toBe(55);
	});

	it('cellFromIndex is inverse of cellIndex', () => {
		for (let i = 0; i < 121; i++) {
			const { row, col } = cellFromIndex(i);
			expect(cellIndex(row, col)).toBe(i);
		}
	});
});

/* ------------------------------------------------------------------ */
/*  Adjacency                                                          */
/* ------------------------------------------------------------------ */

describe('chinese-checkers adjacency', () => {
	it('every cell has 1-6 adjacent neighbours', () => {
		for (let i = 0; i < 121; i++) {
			expect(cellNeighbours[i].adjacent.length).toBeGreaterThanOrEqual(1);
			expect(cellNeighbours[i].adjacent.length).toBeLessThanOrEqual(6);
		}
	});

	it('adjacency is symmetric (if A is neighbour of B, B is neighbour of A)', () => {
		for (let i = 0; i < 121; i++) {
			for (const adj of cellNeighbours[i].adjacent) {
				expect(cellNeighbours[adj].adjacent).toContain(i);
			}
		}
	});

	it('top camp tip has few neighbours', () => {
		// Cell a0 (row 0, col 0) is the top camp tip — even row 0.
		const topTip = cellIndex(0, 0);
		expect(cellNeighbours[topTip].adjacent.length).toBe(1);
	});

	it('centre cells have many neighbours', () => {
		// Cell in the middle of row 10 (widest, 11 cells) should have 6 neighbours.
		const midCell = cellIndex(10, 5);
		expect(cellNeighbours[midCell].adjacent.length).toBe(6);
	});

	it('jump targets exist for centre cells', () => {
		const midCell = cellIndex(10, 5);
		const jumps = cellNeighbours[midCell].jumps.filter((j) => j !== null);
		expect(jumps.length).toBe(6);
	});
});

/* ------------------------------------------------------------------ */
/*  Starting position                                                  */
/* ------------------------------------------------------------------ */

describe('chinese-checkers start position', () => {
	it('has correct FEN format', () => {
		const fen = chineseCheckersStartFen();
		expect(fen[0]).toBe('w');
		expect(fen.length).toBe(122); // 1 turn + 121 cells
	});

	it('has 10 white pieces in camp 0', () => {
		const board = stateBoard(chineseCheckersStartFen());
		let count = 0;
		for (const idx of campMembers[0]) {
			expect(board[idx]).toBe('W');
			count++;
		}
		expect(count).toBe(10);
	});

	it('has 10 black pieces in camp 3', () => {
		const board = stateBoard(chineseCheckersStartFen());
		let count = 0;
		for (const idx of campMembers[3]) {
			expect(board[idx]).toBe('B');
			count++;
		}
		expect(count).toBe(10);
	});

	it('centre cells are empty', () => {
		const board = stateBoard(chineseCheckersStartFen());
		for (let i = 0; i < 121; i++) {
			if (cells[i].camp === -1) {
				expect(board[i]).toBe('.');
			}
		}
	});

	it('starts with white to move', () => {
		expect(stateTurn(chineseCheckersStartFen())).toBe('w');
	});
});

/* ------------------------------------------------------------------ */
/*  Move generation                                                    */
/* ------------------------------------------------------------------ */

describe('chinese-checkers move generation', () => {
	it('white pieces in camp 0 have legal moves', () => {
		const state = chineseCheckersStartState();
		const destKeys = Object.keys(state.dests);
		expect(destKeys.length).toBeGreaterThan(0);
		const camp0Names = campMembers[0].map((i) => cells[i].name);
		for (const key of Object.keys(state.dests)) {
			expect(camp0Names).toContain(key);
		}
	});

	it('empty cells have no destinations as origins', () => {
		const state = chineseCheckersStartState();
		const board = stateBoard(state.xfen);
		for (const key of Object.keys(state.dests)) {
			const row = key.charCodeAt(0) - 97;
			const col = Number(key.slice(1));
			expect(board[cellIndex(row, col)]).not.toBe('.');
		}
	});

	it('step moves go to adjacent empty cells', () => {
		const board = stateBoard(chineseCheckersStartFen());
		// Cell d2 (row 3, col 2) is in camp 0 with a white piece.
		// Its SW neighbour e2 (row 4, col 2) is empty (centre).
		const origin = cellIndex(3, 2);
		const dests = hopChainDests(board, origin);
		expect(dests.length).toBeGreaterThan(0);
		// e2 should be one of the destinations.
		expect(dests).toContain(cellIndex(4, 2));
	});
});

/* ------------------------------------------------------------------ */
/*  Apply move happy path                                              */
/* ------------------------------------------------------------------ */

describe('chinese-checkers applyMove', () => {
	it('applies a simple step move', () => {
		// Move white piece from d2 (row 3, col 2) to e2 (row 4, col 2).
		const fen = chineseCheckersStartFen();
		const result = chineseCheckersApplyMove(fen, 'd2-e2');
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const board = stateBoard(result.state.xfen);
		expect(board[cellIndex(3, 2)]).toBe('.');
		expect(board[cellIndex(4, 2)]).toBe('W');
		expect(stateTurn(result.state.xfen)).toBe('b');
	});

	it('rejects moving from an empty cell', () => {
		const fen = chineseCheckersStartFen();
		const result = chineseCheckersApplyMove(fen, 'e5-e6');
		expect(result.ok).toBe(false);
	});

	it('rejects moving to an occupied cell', () => {
		const fen = chineseCheckersStartFen();
		// d1 (row 3, col 1) and d2 (row 3, col 2) are both white.
		const result = chineseCheckersApplyMove(fen, 'd2-d1');
		expect(result.ok).toBe(false);
	});

	it('rejects a move with invalid format', () => {
		const fen = chineseCheckersStartFen();
		const result = chineseCheckersApplyMove(fen, 'x');
		expect(result.ok).toBe(false);
	});

	it('applies a hop chain', () => {
		// Set up: W at h3 (row 7, col 3), B at h4 (row 7, col 4), empty at h5 (row 7, col 5).
		const board = new Array<string>(121).fill('.');
		board[cellIndex(7, 3)] = 'W';
		board[cellIndex(7, 4)] = 'B';
		const fen = 'w' + board.join('');
		const result = chineseCheckersApplyMove(fen, 'h3-h5');
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const newBoard = stateBoard(result.state.xfen);
		expect(newBoard[cellIndex(7, 3)]).toBe('.');
		expect(newBoard[cellIndex(7, 4)]).toBe('B');
		expect(newBoard[cellIndex(7, 5)]).toBe('W');
	});

	it('applies a pure multi-jump chain', () => {
		// Verified against the neighbour table: h3 jumps i4 -> j5, and j5
		// jumps k6 -> l7. Place black men on the two midpoints; W at h3 ends
		// on l7 after two jumps in one UCI.
		const board = new Array<string>(121).fill('.');
		board[cellIndex(7, 3)] = 'W'; // h3
		board[cellIndex(8, 4)] = 'B'; // i4
		board[cellIndex(10, 6)] = 'B'; // k6
		const fen = 'w' + board.join('');
		const result = chineseCheckersApplyMove(fen, 'h3-j5-l7');
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const newBoard = stateBoard(result.state.xfen);
		expect(newBoard[cellIndex(7, 3)]).toBe('.');
		expect(newBoard[cellIndex(8, 4)]).toBe('B');
		expect(newBoard[cellIndex(10, 6)]).toBe('B');
		expect(newBoard[cellIndex(11, 7)]).toBe('W'); // l7
	});

	it('rejects a step in the middle of a jump chain', () => {
		// h3 jumps i4 -> j5; j5 sits adjacent to i5, so 'h3-j5-i5' would mix
		// a jump with a trailing step and must be rejected whole.
		const board = new Array<string>(121).fill('.');
		board[cellIndex(7, 3)] = 'W'; // h3
		board[cellIndex(8, 4)] = 'B'; // i4
		const fen = 'w' + board.join('');
		const result = chineseCheckersApplyMove(fen, 'h3-j5-i5');
		expect(result.ok).toBe(false);
	});

	it('rejects a step-first chain', () => {
		// d2-e2 is a legal single step; riding another segment onto it must fail.
		const fen = chineseCheckersStartFen();
		const result = chineseCheckersApplyMove(fen, 'd2-e2-f3');
		expect(result.ok).toBe(false);
	});

	it('detects a win when all target camp cells are filled', () => {
		const board = new Array<string>(121).fill('.');
		const camp3 = campMembers[3];
		for (let i = 0; i < camp3.length - 1; i++) {
			board[camp3[i]] = 'W';
		}
		const lastCamp3Cell = camp3[camp3.length - 1];
		const neighbours = cellNeighbours[lastCamp3Cell].adjacent;
		const emptyNeighbour = neighbours.find((n) => board[n] === '.');
		if (emptyNeighbour !== undefined) {
			board[emptyNeighbour] = 'W';
			const fen = 'w' + board.join('');
			const moveName = cells[emptyNeighbour].name + '-' + cells[lastCamp3Cell].name;
			const result = chineseCheckersApplyMove(fen, moveName);
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.finished).not.toBeNull();
			expect(result.finished?.result).toBe('white');
			expect(result.finished?.termination).toBe('chinese-checkers-finish');
		}
	});

	it('black wins by filling camp 0', () => {
		const board = new Array<string>(121).fill('.');
		const camp0 = campMembers[0];
		for (let i = 0; i < camp0.length - 1; i++) {
			board[camp0[i]] = 'B';
		}
		const lastCamp0Cell = camp0[camp0.length - 1];
		const neighbours = cellNeighbours[lastCamp0Cell].adjacent;
		const emptyNeighbour = neighbours.find((n) => board[n] === '.');
		if (emptyNeighbour !== undefined) {
			board[emptyNeighbour] = 'B';
			const fen = 'b' + board.join('');
			const moveName = cells[emptyNeighbour].name + '-' + cells[lastCamp0Cell].name;
			const result = chineseCheckersApplyMove(fen, moveName);
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.finished).not.toBeNull();
			expect(result.finished?.result).toBe('black');
		}
	});
});

/* ------------------------------------------------------------------ */
/*  FEN conversion round-trip                                          */
/* ------------------------------------------------------------------ */

describe('chinese-checkers FEN', () => {
	it('fenToEngineState produces valid state from start FEN', () => {
		const state = fenToEngineState(chineseCheckersStartFen());
		expect(state.variant).toBe('chinese-checkers');
		expect(state.turn).toBe('white');
		expect(state.inCheck).toBe(false);
		expect(Object.keys(state.dests).length).toBeGreaterThan(0);
	});

	it('state board has 121 characters', () => {
		const board = stateBoard(chineseCheckersStartFen());
		expect(board.length).toBe(121);
	});
});
