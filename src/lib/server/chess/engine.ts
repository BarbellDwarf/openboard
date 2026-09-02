import { chessgroundDests, lichessRules } from 'chessops/compat';
import { normalizeMove } from 'chessops/chess';
import { makeFen, parseFen } from 'chessops/fen';
import { makeSanAndPlay } from 'chessops/san';
import { defaultPosition, setupPosition } from 'chessops/variant';
import { isDrop, makeSquare, parseUci } from 'chessops';
import type { Move, Role } from 'chessops/types';
import type { Position } from 'chessops/chess';
import type { Rules } from 'chessops/types';

import type {
	ApplyMoveResult,
	DestMap,
	EngineState,
	ResultValue,
	Termination,
	VariantId
} from './types';
import { draughtsStartPosition, draughtsApplyMoveResult } from './draughts';
import { chineseCheckersStartState, chineseCheckersApplyMove } from './chinese-checkers';

/**
 * Pure rules layer over chessops. No database access here; persistence lives
 * in game-service. The server is the only authority on legality.
 */

export function isChess960(variant: VariantId): boolean {
	return variant === 'chess960';
}

function rulesFor(variant: VariantId): Rules {
	switch (variant) {
		case 'standard':
		case 'chess960':
			return 'chess';
		case 'kingofthehill':
			return lichessRules('kingOfTheHill');
		case 'threecheck':
			return lichessRules('threeCheck');
		case 'racingkings':
			return lichessRules('racingKings');
		case 'checkers':
			throw new Error('checkers uses draughts engine, not chessops');
		case 'chinese-checkers':
			throw new Error('chinese-checkers uses its own engine, not chessops');
		default:
			return lichessRules(variant);
	}
}

export function loadPosition(variant: VariantId, xfen?: string): Position {
	const rules = rulesFor(variant);
	if (xfen === undefined || xfen === '') return defaultPosition(rules);
	const setup = parseFen(xfen).unwrap();
	return setupPosition(rules, setup).unwrap();
}

export function stateFromPosition(pos: Position, variant: VariantId): EngineState {
	const dests = destsFor(pos, variant);
	const state: EngineState = {
		variant,
		xfen: makeFen(pos.toSetup()),
		turn: pos.turn === 'white' ? 'white' : 'black',
		dests,
		inCheck: pos.isCheck()
	};
	if (variant === 'crazyhouse' && pos.pockets) {
		state.pockets = countPockets(pos.pockets);
	}
	if (variant === 'threecheck' && pos.remainingChecks) {
		state.checkCount = {
			white: 3 - pos.remainingChecks.white,
			black: 3 - pos.remainingChecks.black
		};
	}
	return state;
}

function destsFor(pos: Position, variant: VariantId): DestMap {
	const map = chessgroundDests(pos, { chess960: isChess960(variant) });
	const out: DestMap = {};
	for (const [from, tos] of map.entries()) out[from] = [...tos];
	if (pos.rules === 'crazyhouse' && pos.dropDests) {
		const dropSquares = [...pos.dropDests(pos.ctx())];
		for (const [role, letter] of Object.entries(ROLE_LETTERS)) {
			if (role === 'king') continue;
			let squares = dropSquares;
			if (role === 'pawn') squares = squares.filter((sq) => sq >= 8 && sq <= 55);
			if (squares.length > 0) out[`drop:${letter}`] = squares.map(makeSquare);
		}
	}
	return out;
}

const ROLE_LETTERS: Record<string, string> = {
	pawn: 'p',
	knight: 'n',
	bishop: 'b',
	rook: 'r',
	queen: 'q',
	king: 'k'
};

function countPockets(pockets: Position['pockets']): Record<string, number> {
	const out: Record<string, number> = {};
	if (!pockets) return out;
	for (const [role, letter] of Object.entries(ROLE_LETTERS)) {
		const w = (pockets.white as unknown as Record<string, number>)[role] ?? 0;
		const b = (pockets.black as unknown as Record<string, number>)[role] ?? 0;
		if (w > 0) out[`w${letter}`] = w;
		if (b > 0) out[`b${letter}`] = b;
	}
	return out;
}

export function startPosition(variant: VariantId): EngineState {
	if (variant === 'checkers') return draughtsStartPosition();
	if (variant === 'chinese-checkers') return chineseCheckersStartState();
	return stateFromPosition(loadPosition(variant), variant);
}

/**
 * Builds a valid Chess960 starting position. Bishops sit on opposite-colored
 * files, the king lands strictly between the two rooks, and black's back rank
 * mirrors white's so the array is reproducible in X-FEN. Pure and injectable
 * for tests: pass a seeded rand in [0, 1) for determinism.
 */
export function chess960StartFen(rand: () => number = Math.random): string {
	const darkFiles = ['b', 'd', 'f', 'h'];
	const lightFiles = ['a', 'c', 'e', 'g'];
	const pick = (arr: string[]): string => {
		const index = Math.min(Math.floor(rand() * arr.length), arr.length - 1);
		return arr.splice(index, 1)[0];
	};
	const placement: Record<string, string> = {};
	placement[pick(darkFiles)] = 'B';
	placement[pick(lightFiles)] = 'B';
	const remaining = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].filter((f) => !placement[f]);
	placement[pick(remaining)] = 'Q';
	placement[pick(remaining)] = 'N';
	placement[pick(remaining)] = 'N';
	// Three squares left: rook, king, rook, with the king between the rooks.
	placement[remaining[1]] = 'K';
	placement[remaining[0]] = 'R';
	placement[remaining[2]] = 'R';
	const white = 'abcdefgh'
		.split('')
		.map((f) => placement[f])
		.join('');
	const black = white.split('').reverse().join('').toLowerCase();
	return `${black}/pppppppp/8/8/8/8/PPPPPPPP/${white} w KQkq - 0 1`;
}

/**
 * Applies a horde promotion directly: chessops rejects every last-rank pawn
 * move for the horde side, so the resulting position is built by hand from
 * the current FEN. Validates geometry and occupancy before mutating.
 */
function applyHordePromotion(
	pos: Position,
	xfen: string,
	from: number,
	to: number,
	promotion: Role
): ApplyMoveResult {
	const mover = pos.board.get(from);
	if (!mover || mover.role !== 'pawn' || mover.color !== 'white') {
		return { ok: false, error: 'illegal-move' };
	}
	const target = pos.board.get(to);
	if (target && target.color !== 'black') return { ok: false, error: 'illegal-move' };

	const letters: Record<string, string> = { queen: 'Q', rook: 'R', bishop: 'B', knight: 'N' };
	const letter = letters[promotion];
	if (!letter) return { ok: false, error: 'illegal-move' };

	const rows = xfen.split(' ')[0].split('/');
	const rowOf = (square: number): number => 7 - Math.floor(square / 8);
	const colOf = (square: number): number => square % 8;
	const expand = (row: string): string[] => {
		const out: string[] = [];
		for (const ch of row) {
			if (/\d/.test(ch)) out.push(...Array(Number(ch)).fill('.'));
			else out.push(ch);
		}
		return out;
	};
	const compress = (cells: string[]): string => {
		let out = '';
		let empty = 0;
		for (const c of cells) {
			if (c === '.') empty++;
			else {
				if (empty) out += String(empty);
				empty = 0;
				out += c;
			}
		}
		return out;
	};

	const fRow = rowOf(from);
	const fCol = colOf(from);
	const tRow = rowOf(to);
	const tCol = colOf(to);
	const fromCells = expand(rows[fRow]);
	if (fromCells[fCol] !== 'P') return { ok: false, error: 'illegal-move' };
	fromCells[fCol] = '.';
	const toCells = rows.length > tRow ? expand(rows[tRow]) : [];
	toCells[tCol] = letter;

	const placement = [...rows];
	placement[fRow] = compress(fromCells);
	placement[tRow] = compress(toCells);

	const parts = xfen.split(' ');
	const newFen = `${placement.join('/')} b ${parts[2] ?? 'kq'} - 0 ${parts[5] ?? '1'}`;

	try {
		const nextPos = loadPosition('horde', newFen);
		const state = stateFromPosition(nextPos, 'horde');
		const san = `${target ? 'x' : ''}${makeSquare(to)}=${letter}${state.inCheck ? '+' : ''}`;
		return {
			ok: true,
			san,
			uci: `${makeSquare(from)}${makeSquare(to)}${letter.toLowerCase()}`,
			state,
			finished: detectFinish(nextPos)
		};
	} catch {
		return { ok: false, error: 'invalid-position' };
	}
}

export function applyMove(variant: VariantId, xfen: string, uci: string): ApplyMoveResult {
	if (variant === 'checkers') {
		const result = draughtsApplyMoveResult(xfen, uci);
		if (!result.ok) return { ok: false, error: result.error as 'illegal-move' };
		return {
			ok: true,
			state: result.state,
			san: result.san,
			uci: result.uci,
			finished: result.finished
		};
	}

	if (variant === 'chinese-checkers') {
		const result = chineseCheckersApplyMove(xfen, uci);
		if (!result.ok) return { ok: false, error: result.error as 'illegal-move' };
		return {
			ok: true,
			state: result.state,
			san: result.san,
			uci: result.uci,
			finished: result.finished
		};
	}

	let pos: Position;

	try {
		pos = loadPosition(variant, xfen);
	} catch {
		return { ok: false, error: 'invalid-position' };
	}

	const parsed = parseUci(uci);
	if (!parsed) return { ok: false, error: 'invalid-move-format' };

	// A pawn reaching its promotion rank must declare the promoted piece.
	if ('from' in parsed) {
		const destRank = Math.floor(parsed.to / 8);
		const mover = pos.board.get(parsed.from);
		const promoRank = mover?.role === 'pawn' ? (mover.color === 'white' ? 7 : 0) : null;
		if (promoRank !== null && destRank === promoRank && parsed.promotion === undefined) {
			return { ok: false, error: 'promotion-piece-required' };
		}
	}

	// chessops cannot process promotions for the horde side (its Horde rules
	// reject every last-rank pawn move), so horde promotions are applied here
	// through direct board surgery with full geometric validation.
	if (variant === 'horde' && 'from' in parsed && parsed.promotion) {
		const mover = pos.board.get(parsed.from);
		const target = pos.board.get(parsed.to);
		if (
			mover?.role === 'pawn' &&
			mover.color === 'white' &&
			(!target || target.color === 'black') &&
			Math.abs((parsed.from % 8) - (parsed.to % 8)) <= 1
		) {
			return applyHordePromotion(pos, xfen, parsed.from, parsed.to, parsed.promotion);
		}
	}

	const move = normalizeMove(pos, parsed);

	if (!isLegalByName(pos, variant, move)) return { ok: false, error: 'illegal-move' };

	const san = makeSanAndPlay(pos, move);

	// Post-guard: no pawn may remain on the rank it promotes to.
	for (let square = 0; square < 64; square++) {
		const piece = pos.board.get(square);
		const rank = Math.floor(square / 8);
		if (
			piece?.role === 'pawn' &&
			((piece.color === 'white' && rank === 7) || (piece.color === 'black' && rank === 0))
		) {
			return { ok: false, error: 'invalid-position' };
		}
	}

	const finished = detectFinish(pos);

	return {
		ok: true,
		san,
		uci,
		state: stateFromPosition(pos, variant),
		finished
	};
}

function isLegalByName(pos: Position, variant: VariantId, move: Move): boolean {
	if (isDrop(move)) {
		if (pos.rules !== 'crazyhouse') return false;
		let ok = pos.dropDests(pos.ctx()).has(move.to);
		if (ok && move.role === 'pawn') ok = move.to >= 8 && move.to <= 55;
		return ok;
	}
	const from = makeSquare(move.from);
	const to = makeSquare(move.to);
	const dests = chessgroundDests(pos, { chess960: isChess960(variant) }).get(from);
	return dests !== undefined && dests.includes(to);
}

export function detectFinish(
	pos: Position
): { result: ResultValue; termination: Termination } | null {
	if (pos.isVariantEnd?.()) {
		const outcome = pos.variantOutcome();
		return { result: outcomeToResult(outcome), termination: variantTermination(pos) };
	}
	if (pos.isCheckmate()) return { result: loserIs(pos.turn), termination: 'checkmate' };
	if (pos.isStalemate()) return { result: 'draw', termination: 'stalemate' };
	if (pos.isInsufficientMaterial()) return { result: 'draw', termination: 'insufficient' };
	return null;
}

function variantTermination(pos: Position): Termination {
	switch (pos.rules) {
		case 'kingofthehill':
			return 'kingofthehill';
		case '3check':
			return 'threecheck';
		case 'atomic':
			return 'atomic-king-death';
		case 'horde':
			return 'horde-wiped';
		case 'racingkings':
			return 'racingkings-finish';
		default:
			return 'insufficient';
	}
}

function outcomeToResult(
	outcome: { winner: 'white' | 'black' | undefined } | undefined
): ResultValue {
	if (!outcome || outcome.winner === undefined) return 'draw';
	return outcome.winner;
}

function loserIs(turnToMove: 'white' | 'black'): ResultValue {
	return turnToMove === 'white' ? 'black' : 'white';
}

/** Repetition and fifty-move detection need history the position does not keep. */
export function drawByRepetition(xfenHistory: string[]): boolean {
	if (xfenHistory.length < 3) return false;
	const key = (f: string) => f.split(' ').slice(0, 4).join(' ');
	const current = key(xfenHistory[xfenHistory.length - 1]);
	let count = 0;
	for (const f of xfenHistory) if (key(f) === current) count++;
	return count >= 3;
}

/**
 * Stored ply history only holds positions AFTER each played move; ply 0 (the
 * variant's start position) never appears among them. Seed it here, or a
 * position occurring at move 0 plus twice later counts twice and never
 * reaches the threefold threshold.
 */
export function drawByThreefold(
	variant: VariantId,
	xfensAfterEachPly: string[],
	latestXfen: string,
	startXfen?: string
): boolean {
	const seed = startXfen ?? startPosition(variant).xfen;
	return drawByRepetition([seed, ...xfensAfterEachPly, latestXfen]);
}

export function drawByFiftyMoves(xfen: string): boolean {
	const halfmoves = Number.parseInt(xfen.split(' ')[4] ?? '0', 10);
	return halfmoves >= 100;
}
