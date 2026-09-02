/**
 * American draughts (checkers) rules engine. Pure functions, no DB access.
 * 8x8 board, 12 pieces per side on dark squares, mandatory captures,
 * multi-jump chains (no maximum-capture rule), kings crown on the last rank
 * and move/capture one square diagonally in all directions.
 */

import type { EngineState, FinishedInfo, ResultValue } from './types';

/* ------------------------------------------------------------------ */
/*  Square helpers                                                     */
/* ------------------------------------------------------------------ */

function fileOf(sq: string): number {
	return sq.charCodeAt(0) - 97;
}
function rankOf(sq: string): number {
	return Number(sq[1]) - 1;
}
function toSquare(file: number, rank: number): string {
	return String.fromCharCode(97 + file) + String(rank + 1);
}
function isOnBoard(file: number, rank: number): boolean {
	return file >= 0 && file <= 7 && rank >= 0 && rank <= 7;
}

/* ------------------------------------------------------------------ */
/*  Piece and board types                                              */
/* ------------------------------------------------------------------ */

interface Piece {
	color: 'white' | 'black';
	king: boolean;
}

type Board = Map<string, Piece>;

export interface DraughtsState {
	board: Board;
	turn: 'white' | 'black';
}

/* ------------------------------------------------------------------ */
/*  FEN encoding / decoding                                            */
/* ------------------------------------------------------------------ */

/**
 * FEN for the standard American draughts start position.
 * Pieces occupy dark squares (a1 is dark): rank 1 → a1,c1,e1,g1;
 * rank 2 → b2,d2,f2,h2; rank 3 → a3,c3,e3,g3, etc.
 */
const START_FEN = '1p1p1p1p/p1p1p1p1/1p1p1p1p/8/8/P1P1P1P1/1P1P1P1P/P1P1P1P1 w - - 0 1';

export function draughtsStartFen(): string {
	return START_FEN;
}

export function draughtsToFen(state: DraughtsState): string {
	let fen = '';
	for (let rank = 7; rank >= 0; rank--) {
		let empty = 0;
		for (let file = 0; file < 8; file++) {
			const sq = toSquare(file, rank);
			const piece = state.board.get(sq);
			if (piece) {
				if (empty > 0) {
					fen += String(empty);
					empty = 0;
				}
				const ch = piece.king ? 'k' : 'p';
				fen += piece.color === 'white' ? ch.toUpperCase() : ch;
			} else {
				empty++;
			}
		}
		if (empty > 0) fen += String(empty);
		if (rank > 0) fen += '/';
	}
	fen += ` ${state.turn === 'white' ? 'w' : 'b'} - - 0 1`;
	return fen;
}

export function draughtsFromFen(fen: string): DraughtsState {
	const parts = fen.split(' ');
	const rows = parts[0].split('/');
	const board: Board = new Map();

	for (let rank = 7; rank >= 0; rank--) {
		const row = rows[7 - rank];
		let file = 0;
		for (const ch of row) {
			if (ch >= '1' && ch <= '8') {
				file += Number(ch);
			} else {
				const sq = toSquare(file, rank);
				const color = ch === ch.toUpperCase() ? 'white' : 'black';
				const king = ch.toLowerCase() === 'k';
				board.set(sq, { color, king });
				file++;
			}
		}
	}

	return { board, turn: parts[1] === 'b' ? 'black' : 'white' };
}

/* ------------------------------------------------------------------ */
/*  Piece queries                                                      */
/* ------------------------------------------------------------------ */

function moveDirections(piece: Piece): [number, number][] {
	if (piece.king)
		return [
			[-1, -1],
			[-1, 1],
			[1, -1],
			[1, 1]
		];
	// Men move forward: white toward rank 8 (+1), black toward rank 1 (-1).
	return piece.color === 'white'
		? [
				[-1, 1],
				[1, 1]
			]
		: [
				[-1, -1],
				[1, -1]
			];
}

function countPieces(state: DraughtsState): { white: number; black: number } {
	let white = 0;
	let black = 0;
	for (const piece of state.board.values()) {
		if (piece.color === 'white') white++;
		else black++;
	}
	return { white, black };
}

/* ------------------------------------------------------------------ */
/*  Move generation                                                    */
/* ------------------------------------------------------------------ */

/**
 * Collect all maximal capture chains starting from `origin`.
 * Each chain is the sequence of destination squares (not including origin).
 * Captured squares are the intermediate squares removed along the way.
 */
function captureChains(state: DraughtsState, origin: string): string[][] {
	const piece = state.board.get(origin);
	if (!piece) return [];

	const results: string[][] = [];
	const dirs = moveDirections(piece);

	function search(cur: string, visited: Set<string>, chain: string[]): void {
		const cf = fileOf(cur);
		const cr = rankOf(cur);

		for (const [df, dr] of dirs) {
			const midF = cf + df;
			const midR = cr + dr;
			const midSq = toSquare(midF, midR);

			const destF = midF + df;
			const destR = midR + dr;
			if (!isOnBoard(destF, destR)) continue;
			const destSq = toSquare(destF, destR);

			if (visited.has(destSq)) continue;
			// A jump must land on an empty square: applying a jump onto an
			// occupied square would silently overwrite the occupant.
			if (state.board.has(destSq)) continue;

			const midPiece = state.board.get(midSq);
			if (midPiece && midPiece.color !== piece!.color && !visited.has(midSq)) {
				const next = new Set(visited);
				next.add(midSq);
				next.add(destSq);

				const nextChain = [...chain, destSq];
				results.push(nextChain);

				// Recurse for multi-jumps.
				search(destSq, next, nextChain);
			}
		}
	}

	search(origin, new Set([origin]), []);
	return results;
}

/** Simple non-capture moves for one piece. */
function simpleMoves(state: DraughtsState, origin: string): string[] {
	const piece = state.board.get(origin);
	if (!piece) return [];

	const moves: string[] = [];
	const dirs = moveDirections(piece);

	for (const [df, dr] of dirs) {
		const f = fileOf(origin) + df;
		const r = rankOf(origin) + dr;
		if (!isOnBoard(f, r)) continue;
		const dest = toSquare(f, r);
		if (!state.board.has(dest)) moves.push(dest);
	}
	return moves;
}

/**
 * Compute all legal destinations for the side to move.
 * Returns the chessground-compatible dests map. When captures exist only
 * the first hop of every capture chain is shown (the server applies one
 * hop at a time so multi-jumps play through the client click loop).
 */
export function draughtsDests(state: DraughtsState): Record<string, string[]> {
	const dests: Record<string, string[]> = {};

	// Phase 1: check whether any capture exists.
	const captureMap = new Map<string, string[][]>();
	for (const [sq, piece] of state.board) {
		if (piece.color !== state.turn) continue;
		const chains = captureChains(state, sq);
		if (chains.length > 0) captureMap.set(sq, chains);
	}

	if (captureMap.size > 0) {
		// Mandatory capture: show only the first hop destination for each chain.
		for (const [sq, chains] of captureMap) {
			const firstHops = new Set<string>();
			for (const chain of chains) firstHops.add(chain[0]);
			dests[sq] = [...firstHops];
		}
		return dests;
	}

	// Phase 2: simple moves.
	for (const [sq, piece] of state.board) {
		if (piece.color !== state.turn) continue;
		const moves = simpleMoves(state, sq);
		if (moves.length > 0) dests[sq] = moves;
	}
	return dests;
}

/* ------------------------------------------------------------------ */
/*  Move application                                                   */
/* ------------------------------------------------------------------ */

/**
 * Apply a single UCI move (e.g. "c3e5" or "c3e5g7" for a chain).
 * The UCI may contain multiple hops; each hop must be a legal jump or
 * a simple diagonal step. Returns the resulting state.
 */
export function draughtsApplyMove(state: DraughtsState, uci: string): DraughtsState {
	const squares = uci.match(/[a-h][1-8]/g);
	if (!squares || squares.length < 2) throw new Error('draughts: invalid UCI');

	const board = new Map(state.board);
	const piece = board.get(squares[0]);
	if (!piece || piece.color !== state.turn) throw new Error('draughts: no piece at origin');

	// Track chain for crowning check at the end.
	let current = piece;
	const newBoard = board;
	newBoard.delete(squares[0]);

	for (let i = 1; i < squares.length; i++) {
		const from = squares[i - 1];
		const to = squares[i];
		const ff = fileOf(from);
		const fr = rankOf(from);
		const tf = fileOf(to);
		const tr = rankOf(to);
		const dist = Math.abs(tf - ff);

		if (dist > 1) {
			// Capture: remove the jumped piece.
			const midSq = toSquare((ff + tf) / 2, (fr + tr) / 2);
			newBoard.delete(midSq);
		}

		newBoard.set(to, current);
	}

	// Crown the piece if it has reached the opposite back rank.
	const lastSq = squares[squares.length - 1];
	const lastRank = rankOf(lastSq);
	if (
		!current.king &&
		((current.color === 'white' && lastRank === 7) || (current.color === 'black' && lastRank === 0))
	) {
		current = { ...current, king: true };
		newBoard.set(lastSq, current);
	}

	// Determine next turn. If the piece that just moved has continuation
	// captures available, the same side must keep jumping (mandatory chain).
	let nextTurn: 'white' | 'black' = state.turn === 'white' ? 'black' : 'white';
	const cont = captureChains({ board: newBoard, turn: state.turn }, lastSq);
	if (cont.length > 0) nextTurn = state.turn;

	return { board: newBoard, turn: nextTurn };
}

/* ------------------------------------------------------------------ */
/*  Finish detection                                                   */
/* ------------------------------------------------------------------ */

/** Check whether the side to move has any legal move at all. */
function hasAnyLegalMove(state: DraughtsState): boolean {
	for (const [sq, piece] of state.board) {
		if (piece.color !== state.turn) continue;
		if (captureChains(state, sq).length > 0) return true;
		if (simpleMoves(state, sq).length > 0) return true;
	}
	return false;
}

export function draughtsDetectFinish(
	state: DraughtsState
): { result: ResultValue; termination: string } | null {
	const counts = countPieces(state);

	if (counts.white === 0) return { result: 'black', termination: 'no-legal-move' };
	if (counts.black === 0) return { result: 'white', termination: 'no-legal-move' };

	if (!hasAnyLegalMove(state)) {
		// The side to move has no legal move: the opponent wins.
		const winner: ResultValue = state.turn === 'white' ? 'black' : 'white';
		return { result: winner, termination: 'no-legal-move' };
	}

	return null;
}

/* ------------------------------------------------------------------ */
/*  Engine integration                                                 */
/* ------------------------------------------------------------------ */

export function draughtsStartPosition(): EngineState {
	const fen = draughtsStartFen();
	const state = draughtsFromFen(fen);
	return draughtsToEngineState(state, 'checkers');
}

export function draughtsLoadState(xfen: string): DraughtsState {
	return draughtsFromFen(xfen);
}

/**
 * Convert an internal DraughtsState to the shared EngineState contract
 * consumed by the realtime layer and the UI.
 */
export function draughtsToEngineState(
	state: DraughtsState,
	variant: 'checkers' = 'checkers'
): EngineState {
	return {
		variant,
		xfen: draughtsToFen(state),
		turn: state.turn,
		dests: draughtsDests(state),
		inCheck: false
	};
}

/**
 * Validate every hop of a multi-hop UCI against the capture rules, mirroring
 * captureChains exactly: directions come from the piece as it stands on the
 * origin square, each hop is a two-square diagonal jump over an enemy piece
 * onto an empty square, and no square (origin, captured mid, landing) may be
 * reused within the chain. The chain determines its own visited set, so a
 * sequential walk over the hops is equivalent to extending frontier chains.
 * A simple (non-capture) first hop must be the whole move.
 */
function validateChain(state: DraughtsState, squares: string[]): boolean {
	const origin = squares[0];
	const originPiece = state.board.get(origin);
	if (!originPiece) return false;

	// A non-capture move is always exactly two squares.
	if (Math.abs(fileOf(squares[1]) - fileOf(origin)) <= 1) return squares.length === 2;

	const dirs = moveDirections(originPiece);
	const visited = new Set<string>([origin]);

	for (let i = 1; i < squares.length; i++) {
		const from = squares[i - 1];
		const to = squares[i];
		const df = fileOf(to) - fileOf(from);
		const dr = rankOf(to) - rankOf(from);
		if (df % 2 !== 0 || dr % 2 !== 0) return false;
		const dir = dirs.find(([d, r]) => d === df / 2 && r === dr / 2);
		if (!dir) return false;

		const mid = toSquare(fileOf(from) + dir[0], rankOf(from) + dir[1]);
		const midPiece = state.board.get(mid);
		if (!midPiece || midPiece.color === originPiece.color) return false;
		if (visited.has(mid) || visited.has(to) || state.board.has(to)) return false;
		visited.add(mid);
		visited.add(to);
	}
	return true;
}

/**
 * Apply a UCI move in the checkers engine and return the full
 * ApplyMoveResult shape the server expects.
 */
export function draughtsApplyMoveResult(
	xfen: string,
	uci: string
):
	| { ok: true; state: EngineState; san: string; uci: string; finished: FinishedInfo | null }
	| { ok: false; error: string } {
	let state: DraughtsState;
	try {
		state = draughtsFromFen(xfen);
	} catch {
		return { ok: false, error: 'invalid-position' };
	}

	// Validate that the origin holds the right color.
	const squares = uci.match(/[a-h][1-8]/g);
	if (!squares || squares.length < 2) return { ok: false, error: 'invalid-move-format' };

	// Cap chain length, and reject any UCI whose matched squares do not span
	// the whole raw string: a token such as "h9" cannot match the square
	// pattern and would otherwise vanish silently.
	if (squares.length > 64) return { ok: false, error: 'invalid-move-format' };
	if (uci !== squares.join('')) return { ok: false, error: 'invalid-move-format' };

	const originPiece = state.board.get(squares[0]);
	if (!originPiece || originPiece.color !== state.turn) {
		return { ok: false, error: 'illegal-move' };
	}

	// Validate the full chain against legal dests.
	// For multi-hop UCI the first hop must be in dests; each subsequent hop
	// must be a legal continuation from the intermediate square.
	const legalDests = draughtsDests(state);
	const firstDests = legalDests[squares[0]];
	if (!firstDests || !firstDests.includes(squares[1])) {
		return { ok: false, error: 'illegal-move' };
	}

	// Hops two and beyond must extend a legal capture chain: the client plays
	// one hop per UCI, so a longer UCI is always a direct socket move and must
	// be checked here rather than trusted.
	if (!validateChain(state, squares)) {
		return { ok: false, error: 'illegal-move' };
	}

	// Apply the full chain.
	let newState: DraughtsState;
	try {
		newState = draughtsApplyMove(state, uci);
	} catch {
		return { ok: false, error: 'illegal-move' };
	}

	// Build SAN: join squares with 'x' for captures or '-' for non-captures.
	const isCapture = Math.abs(fileOf(squares[1]) - fileOf(squares[0])) > 1;
	const sep = isCapture ? 'x' : '-';
	const san = squares.join(sep);

	// Check for game-ending condition.
	const finish = draughtsDetectFinish(newState);

	return {
		ok: true,
		state: draughtsToEngineState(newState),
		san,
		uci,
		finished: finish ? { result: finish.result, termination: finish.termination as never } : null
	};
}
