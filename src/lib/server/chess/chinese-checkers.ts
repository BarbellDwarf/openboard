/**
 * Chinese Checkers engine. Pure functions, no DB access.
 *
 * Board geometry lives in $lib/shared/chinese-checkers-board.
 * This module owns game state, move generation, and win detection.
 */

import type { EngineState, FinishedInfo, ResultValue } from './types';

import {
	cells,
	cellIndex,
	cellNeighbours,
	campMembers,
	BLACK_CAMP,
	WHITE_CAMP,
	targetCamp,
	parseCellName,
	rowLength,
	BOARD_ROWS,
	TOTAL_CELLS
} from '$lib/shared/chinese-checkers-board';

/* ------------------------------------------------------------------ */
/*  Re-export shared board data for convenience                        */
/* ------------------------------------------------------------------ */

export {
	cells,
	cellIndex,
	cellFromIndex,
	cellNeighbours,
	campMembers,
	parseCellName
} from '$lib/shared/chinese-checkers-board';

/* ------------------------------------------------------------------ */
/*  State encoding                                                     */
/* ------------------------------------------------------------------ */

/**
 * Compact string encoding: turn character ('w' or 'b') followed by 121
 * cell characters ('.' empty, 'W' white, 'B' black).
 */
export function makeState(turn: 'w' | 'b', board: string): string {
	return turn + board;
}

export function stateTurn(state: string): 'w' | 'b' {
	return state[0] as 'w' | 'b';
}

export function stateBoard(state: string): string {
	return state.slice(1);
}

function boardAt(board: string, idx: number): 'W' | 'B' | '.' {
	return board[idx] as 'W' | 'B' | '.';
}

function boardSet(board: string, idx: number, ch: 'W' | 'B' | '.'): string {
	return board.slice(0, idx) + ch + board.slice(idx + 1);
}

/* ------------------------------------------------------------------ */
/*  Starting position                                                  */
/* ------------------------------------------------------------------ */

export function chineseCheckersStartBoard(): string {
	const b = new Array<string>(TOTAL_CELLS).fill('.');
	for (const idx of campMembers[WHITE_CAMP]) b[idx] = 'W';
	for (const idx of campMembers[BLACK_CAMP]) b[idx] = 'B';
	return b.join('');
}

export function chineseCheckersStartFen(): string {
	return makeState('w', chineseCheckersStartBoard());
}

export function chineseCheckersStartState(): EngineState {
	return fenToEngineState(chineseCheckersStartFen());
}

/* ------------------------------------------------------------------ */
/*  FEN conversion                                                     */
/* ------------------------------------------------------------------ */

export function fenToEngineState(fen: string): EngineState {
	const turn = stateTurn(fen);
	const board = stateBoard(fen);
	return {
		variant: 'chinese-checkers' as EngineState['variant'],
		xfen: fen,
		turn: turn === 'w' ? 'white' : 'black',
		dests: computeDests(board, turn),
		inCheck: false
	};
}

/* ------------------------------------------------------------------ */
/*  Move generation                                                    */
/* ------------------------------------------------------------------ */

export function hopChainDests(board: string, origin: number): number[] {
	const piece = boardAt(board, origin);
	if (piece === '.') return [];

	const results = new Set<number>();
	const visited = new Set<number>([origin]);

	function search(cur: number): void {
		const { adjacent, jumps } = cellNeighbours[cur];
		for (const adj of adjacent) {
			if (boardAt(board, adj) === '.' && !visited.has(adj)) {
				results.add(adj);
			}
		}
		for (let d = 0; d < jumps.length; d++) {
			const jmp = jumps[d];
			if (jmp === null) continue;
			const mid = adjacent[d];
			if (mid === undefined) continue;
			if (boardAt(board, mid) !== '.' && boardAt(board, jmp) === '.' && !visited.has(jmp)) {
				results.add(jmp);
				visited.add(jmp);
				search(jmp);
			}
		}
	}

	search(origin);
	results.delete(origin);
	return [...results].sort((a, b) => a - b);
}

export function computeDests(board: string, turn: 'w' | 'b'): Record<string, string[]> {
	const pieceChar = turn === 'w' ? 'W' : 'B';
	const dests: Record<string, string[]> = {};

	for (let i = 0; i < TOTAL_CELLS; i++) {
		if (boardAt(board, i) !== pieceChar) continue;
		const destIndices = hopChainDests(board, i);
		if (destIndices.length > 0) {
			const originName = cells[i].name;
			dests[originName] = destIndices.map((d) => cells[d].name);
		}
	}

	return dests;
}

/* ------------------------------------------------------------------ */
/*  Move application                                                   */
/* ------------------------------------------------------------------ */

export function chineseCheckersApplyMove(
	fen: string,
	uci: string
):
	| { ok: true; state: EngineState; san: string; uci: string; finished: FinishedInfo | null }
	| { ok: false; error: string } {
	let turn: 'w' | 'b';
	let board: string;
	try {
		turn = stateTurn(fen);
		board = stateBoard(fen);
	} catch {
		return { ok: false, error: 'invalid-position' };
	}

	const segments = uci.split('-');
	if (segments.length < 2) return { ok: false, error: 'invalid-move-format' };

	const indices: number[] = [];
	for (const seg of segments) {
		if (seg.length !== 2) return { ok: false, error: 'invalid-move-format' };
		const { row, col } = parseCellName(seg);
		if (row < 0 || row >= BOARD_ROWS || col < 0 || col >= rowLength(row)) {
			return { ok: false, error: 'invalid-move-format' };
		}
		indices.push(cellIndex(row, col));
	}

	const pieceChar = turn === 'w' ? 'W' : 'B';
	if (boardAt(board, indices[0]) !== pieceChar) {
		return { ok: false, error: 'illegal-move' };
	}

	let currentBoard = board;
	for (let i = 0; i < indices.length - 1; i++) {
		const from = indices[i];
		const to = indices[i + 1];

		if (boardAt(currentBoard, to) !== '.') {
			return { ok: false, error: 'illegal-move' };
		}

		const isAdjacent = cellNeighbours[from].adjacent.includes(to);
		if (isAdjacent) {
			// Simple step.
		} else {
			const jmpIdx = cellNeighbours[from].jumps.indexOf(to);
			if (jmpIdx === -1) {
				return { ok: false, error: 'illegal-move' };
			}
			const mid = cellNeighbours[from].adjacent[jmpIdx];
			if (mid === undefined || boardAt(currentBoard, mid) === '.') {
				return { ok: false, error: 'illegal-move' };
			}
		}

		currentBoard = boardSet(currentBoard, from, '.');
		currentBoard = boardSet(currentBoard, to, pieceChar);
	}

	const nextTurn = turn === 'w' ? 'b' : 'w';
	const winCamp = targetCamp(turn);
	const win = campMembers[winCamp].every((i) => boardAt(currentBoard, i) === pieceChar);

	const newState: EngineState = {
		variant: 'chinese-checkers' as EngineState['variant'],
		xfen: makeState(nextTurn, currentBoard),
		turn: nextTurn === 'w' ? 'white' : 'black',
		dests: computeDests(currentBoard, nextTurn),
		inCheck: false
	};

	const san = segments.join('-');

	return {
		ok: true,
		state: newState,
		san,
		uci,
		finished: win
			? {
					result: (turn === 'w' ? 'white' : 'black') as ResultValue,
					termination: 'chinese-checkers-finish'
				}
			: null
	};
}

/* ------------------------------------------------------------------ */
/*  Win detection                                                      */
/* ------------------------------------------------------------------ */

export function detectChineseCheckersFinish(
	board: string,
	lastMover: 'w' | 'b'
): { result: ResultValue; termination: string } | null {
	const pieceChar = lastMover === 'w' ? 'W' : 'B';
	const winCamp = targetCamp(lastMover);
	const win = campMembers[winCamp].every((i) => boardAt(board, i) === pieceChar);
	if (win) {
		return {
			result: lastMover === 'w' ? 'white' : 'black',
			termination: 'chinese-checkers-finish'
		};
	}
	return null;
}
